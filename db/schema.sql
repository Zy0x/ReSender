-- ============================================================================
--  Telegram Forwarder Bot — schema
--  Jalankan di Supabase SQL Editor (atau psql) dari proyek Supabase Anda.
--  Aman dijalankan ulang (idempotent dengan IF NOT EXISTS).
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";
create extension if not exists "pg_net";

-- ---------- enums --------------------------------------------------------
do $$ begin
  create type forward_mode as enum (
    'native_forward',
    'copy_hide_sender',
    'notify_only',
    'anonymize',
    'media_only',
    'text_only'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type queue_status as enum ('pending','processing','sent','failed','dropped');
exception when duplicate_object then null; end $$;

-- ---------- admins -------------------------------------------------------
create table if not exists tg_admins (
  telegram_user_id bigint primary key,
  display_name     text,
  added_at         timestamptz not null default now()
);

create table if not exists app_users (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  role     text not null default 'admin' check (role in ('admin','viewer')),
  added_at timestamptz not null default now()
);

create or replace function is_app_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_users where user_id = uid and role = 'admin');
$$;

-- ---------- sources / targets -------------------------------------------
create table if not exists tg_sources (
  id          uuid primary key default gen_random_uuid(),
  chat_id     bigint not null unique,
  title       text,
  kind        text check (kind in ('group','supergroup','channel','private','bot')),
  is_active   boolean not null default true,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists tg_targets (
  id          uuid primary key default gen_random_uuid(),
  chat_id     bigint not null unique,
  title       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- rules --------------------------------------------------------
create table if not exists tg_rules (
  id                  uuid primary key default gen_random_uuid(),
  source_id           uuid not null references tg_sources(id) on delete cascade,
  target_id           uuid not null references tg_targets(id) on delete cascade,
  mode                forward_mode not null default 'native_forward',
  -- filter
  allow_text          boolean not null default true,
  allow_media         boolean not null default true,
  allow_links         boolean not null default true,
  allow_forwarded     boolean not null default true,
  keyword_include     text[]  not null default '{}',
  keyword_exclude     text[]  not null default '{}',
  min_len             int     not null default 0,
  max_len             int     not null default 0,
  -- transform
  header_template     text,
  footer_template     text,
  strip_mentions      boolean not null default false,
  strip_links         boolean not null default false,
  strip_usernames     boolean not null default false,
  strip_phone         boolean not null default false,
  custom_replace      jsonb   not null default '[]'::jsonb,
  -- rate limit
  cooldown_seconds    int     not null default 0,
  quota_per_minute    int     not null default 0,
  quota_per_hour      int     not null default 0,
  quota_per_day       int     not null default 0,
  on_excess           text    not null default 'queue' check (on_excess in ('drop','queue')),
  -- delivery
  silent              boolean not null default false,
  protect_content     boolean not null default false,
  schedule_window     jsonb,
  priority            int     not null default 100,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  unique(source_id, target_id)
);
create index if not exists idx_tg_rules_source on tg_rules(source_id) where is_active;

-- ---------- ingest log (idempotency) ------------------------------------
create table if not exists tg_message_log (
  id              bigserial primary key,
  update_id       bigint unique,
  source_chat_id  bigint,
  source_msg_id  bigint,
  payload         jsonb not null,
  received_at     timestamptz not null default now()
);
create index if not exists idx_tg_msglog_chat on tg_message_log(source_chat_id, received_at desc);

-- ---------- forward queue -----------------------------------------------
create table if not exists tg_forward_queue (
  id              bigserial primary key,
  rule_id         uuid references tg_rules(id) on delete cascade,
  source_chat_id  bigint,
  source_msg_id   bigint,
  target_chat_id  bigint,
  mode            forward_mode,
  payload         jsonb,
  not_before      timestamptz not null default now(),
  attempts        int  not null default 0,
  last_error      text,
  status          queue_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_tg_queue_pending
  on tg_forward_queue(not_before)
  where status = 'pending';

-- ---------- rate buckets ------------------------------------------------
create table if not exists tg_rate_buckets (
  rule_id       uuid not null,
  window_kind   text not null,
  window_start  timestamptz not null,
  count         int not null default 0,
  last_sent_at  timestamptz,
  primary key (rule_id, window_kind, window_start)
);

-- ---------- audit log ---------------------------------------------------
create table if not exists tg_audit_log (
  id          bigserial primary key,
  actor       text,
  action      text not null,
  entity      text,
  entity_id   text,
  diff        jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- Atomic rate-limit helper (race-safe across runtimes)
-- ============================================================================
create or replace function tg_consume_rate(
  p_rule_id    uuid,
  p_minute_q   int,
  p_hour_q     int,
  p_day_q      int,
  p_cooldown_s int
)
returns table (allowed boolean, retry_after_seconds int)
language plpgsql as $$
declare
  now_ts        timestamptz := now();
  min_start     timestamptz := date_trunc('minute', now_ts);
  hour_start    timestamptz := date_trunc('hour',   now_ts);
  day_start     timestamptz := date_trunc('day',    now_ts);
  min_count     int;
  hour_count    int;
  day_count     int;
  last_sent     timestamptz;
  retry_s       int := 0;
begin
  -- cooldown check (read last_sent without incrementing yet)
  select max(last_sent_at) into last_sent
  from tg_rate_buckets where rule_id = p_rule_id and window_kind = 'cooldown';

  if p_cooldown_s > 0 and last_sent is not null
     and now_ts < last_sent + make_interval(secs => p_cooldown_s) then
    retry_s := ceil(extract(epoch from (last_sent + make_interval(secs => p_cooldown_s) - now_ts)));
    return query select false, retry_s;
    return;
  end if;

  -- atomic increments
  insert into tg_rate_buckets(rule_id, window_kind, window_start, count)
    values (p_rule_id, 'minute', min_start, 1)
    on conflict (rule_id, window_kind, window_start)
    do update set count = tg_rate_buckets.count + 1
    returning count into min_count;

  insert into tg_rate_buckets(rule_id, window_kind, window_start, count)
    values (p_rule_id, 'hour', hour_start, 1)
    on conflict (rule_id, window_kind, window_start)
    do update set count = tg_rate_buckets.count + 1
    returning count into hour_count;

  insert into tg_rate_buckets(rule_id, window_kind, window_start, count)
    values (p_rule_id, 'day', day_start, 1)
    on conflict (rule_id, window_kind, window_start)
    do update set count = tg_rate_buckets.count + 1
    returning count into day_count;

  if p_minute_q > 0 and min_count > p_minute_q then
    retry_s := ceil(extract(epoch from (min_start + interval '1 minute' - now_ts)));
    return query select false, retry_s; return;
  end if;
  if p_hour_q > 0 and hour_count > p_hour_q then
    retry_s := ceil(extract(epoch from (hour_start + interval '1 hour' - now_ts)));
    return query select false, retry_s; return;
  end if;
  if p_day_q > 0 and day_count > p_day_q then
    retry_s := ceil(extract(epoch from (day_start + interval '1 day' - now_ts)));
    return query select false, retry_s; return;
  end if;

  -- mark cooldown
  insert into tg_rate_buckets(rule_id, window_kind, window_start, count, last_sent_at)
    values (p_rule_id, 'cooldown', date_trunc('hour', now_ts), 1, now_ts)
    on conflict (rule_id, window_kind, window_start)
    do update set count = tg_rate_buckets.count + 1,
                  last_sent_at = excluded.last_sent_at;

  return query select true, 0;
end $$;

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table tg_admins        enable row level security;
alter table app_users        enable row level security;
alter table tg_sources       enable row level security;
alter table tg_targets       enable row level security;
alter table tg_rules         enable row level security;
alter table tg_message_log   enable row level security;
alter table tg_forward_queue enable row level security;
alter table tg_rate_buckets  enable row level security;
alter table tg_audit_log     enable row level security;

-- service_role bypasses RLS automatically. Only define policies for authenticated admins.
do $$ declare t text; begin
  for t in select unnest(array[
    'tg_admins','app_users','tg_sources','tg_targets','tg_rules',
    'tg_message_log','tg_forward_queue','tg_rate_buckets','tg_audit_log'
  ]) loop
    execute format('drop policy if exists %I_admin_all on %I', t, t);
    execute format(
      'create policy %I_admin_all on %I for all to authenticated using (is_app_admin(auth.uid())) with check (is_app_admin(auth.uid()))',
      t, t
    );
  end loop;
end $$;

-- ============================================================================
-- pg_cron drain — set GUCs first:
--   alter database postgres set app.queue_drain_url = 'https://your-app/api/public/tg/process-queue';
--   alter database postgres set app.cron_secret     = 'your-cron-secret';
-- Then enable the schedule:
-- ============================================================================
select cron.unschedule('tg_drain_queue') where exists (
  select 1 from cron.job where jobname = 'tg_drain_queue'
);

select cron.schedule(
  'tg_drain_queue',
  '*/10 * * * * *',  -- every 10s
  $cron$
  select net.http_post(
    url := current_setting('app.queue_drain_url', true),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', current_setting('app.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $cron$
);