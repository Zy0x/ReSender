// deno-lint-ignore-file no-explicit-any
// MIRROR of src/lib/tg/* — Deno-compatible single-file port.
// Kept in sync manually. If you change one side, change the other.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ForwardMode =
  | "native_forward" | "copy_hide_sender" | "notify_only"
  | "anonymize" | "media_only" | "text_only";

export interface Rule {
  id: string; source_id: string; target_id: string; mode: ForwardMode;
  allow_text: boolean; allow_media: boolean; allow_links: boolean; allow_forwarded: boolean;
  keyword_include: string[]; keyword_exclude: string[]; min_len: number; max_len: number;
  header_template: string | null; footer_template: string | null;
  strip_mentions: boolean; strip_links: boolean; strip_usernames: boolean; strip_phone: boolean;
  custom_replace: { from: string; to: string; regex?: boolean }[];
  cooldown_seconds: number; quota_per_minute: number; quota_per_hour: number; quota_per_day: number;
  on_excess: "drop" | "queue"; silent: boolean; protect_content: boolean;
  schedule_window: { tz?: string; allow_hours?: number[] } | null;
  priority: number; is_active: boolean;
  source?: { chat_id: number; title: string | null; is_active: boolean };
  target?: { chat_id: number; title: string | null; is_active: boolean };
}

export interface IncomingMessage {
  message_id: number;
  chat: { id: number; title?: string; type?: string };
  from?: { id: number; username?: string; first_name?: string };
  text?: string; caption?: string;
  forward_from?: unknown; forward_origin?: unknown;
  photo?: unknown; video?: unknown; document?: unknown; audio?: unknown;
  voice?: unknown; sticker?: unknown; animation?: unknown;
  media_group_id?: string;
}

export class TelegramClient {
  constructor(private token: string) {}
  async call<T = any>(method: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json() as any;
    if (!data.ok) {
      const err: any = new Error(`Telegram ${method} failed: ${data.description}`);
      err.retry_after = data.parameters?.retry_after; err.status = res.status;
      throw err;
    }
    return data.result;
  }
  sendMessage(p: any) { return this.call("sendMessage", p); }
}

const RE_MENTION = /@[A-Za-z0-9_]{3,}/g;
const RE_LINK = /\bhttps?:\/\/\S+|\bt\.me\/\S+/gi;
const RE_USERNAME = /\b[a-z0-9_]{4,}\b/gi;
const RE_PHONE = /(\+?\d[\d \-()]{6,}\d)/g;

function hasMedia(m: IncomingMessage) {
  return !!(m.photo || m.video || m.document || m.audio || m.voice || m.sticker || m.animation);
}

function passesFilter(m: IncomingMessage, r: Rule) {
  const text = m.text ?? m.caption ?? "";
  const isMedia = hasMedia(m); const isText = !!m.text;
  if (!r.allow_text && isText && !isMedia) return false;
  if (!r.allow_media && isMedia) return false;
  if (!r.allow_forwarded && (m.forward_from || m.forward_origin)) return false;
  if (!r.allow_links && RE_LINK.test(text)) return false;
  if (r.mode === "media_only" && !isMedia) return false;
  if (r.mode === "text_only" && isMedia) return false;
  if (r.min_len > 0 && text.length < r.min_len) return false;
  if (r.max_len > 0 && text.length > r.max_len) return false;
  for (const kw of r.keyword_exclude ?? []) if (kw && new RegExp(kw, "i").test(text)) return false;
  if ((r.keyword_include ?? []).length > 0) {
    const ok = r.keyword_include.some(kw => kw && new RegExp(kw, "i").test(text));
    if (!ok) return false;
  }
  if (r.schedule_window?.allow_hours?.length) {
    if (!r.schedule_window.allow_hours.includes(new Date().getUTCHours())) return false;
  }
  return true;
}

function applyTextTransform(text: string, r: Rule) {
  let out = text;
  if (r.strip_mentions) out = out.replace(RE_MENTION, "");
  if (r.strip_links) out = out.replace(RE_LINK, "");
  if (r.strip_phone) out = out.replace(RE_PHONE, "");
  if (r.strip_usernames) out = out.replace(RE_USERNAME, s => s.length > 4 ? "***" : s);
  for (const cr of r.custom_replace ?? []) {
    if (!cr?.from) continue;
    if (cr.regex) { try { out = out.replace(new RegExp(cr.from, "g"), cr.to ?? ""); } catch { /* */ } }
    else { out = out.split(cr.from).join(cr.to ?? ""); }
  }
  return out.trim();
}

function applyTemplate(tpl: string | null | undefined, r: Rule, m: IncomingMessage) {
  if (!tpl) return "";
  return tpl
    .replaceAll("{source_title}", r.source?.title ?? String(m.chat.id))
    .replaceAll("{source_id}", String(m.chat.id))
    .replaceAll("{date}", new Date().toISOString())
    .replaceAll("{sender_initial}", (m.from?.first_name ?? "?").slice(0, 1));
}

function buildCalls(rule: Rule, m: IncomingMessage, target: number) {
  const base = { disable_notification: rule.silent || undefined, protect_content: rule.protect_content || undefined };
  const text = m.text ?? m.caption ?? "";
  const transformed = applyTextTransform(text, rule);
  const decorated = [applyTemplate(rule.header_template, rule, m), transformed, applyTemplate(rule.footer_template, rule, m)].filter(Boolean).join("\n");

  if (rule.mode === "native_forward") {
    return [{ method: "forwardMessage", payload: { chat_id: target, from_chat_id: m.chat.id, message_id: m.message_id, ...base } }];
  }
  if (rule.mode === "notify_only") {
    const summary = `📨 Pesan baru di *${(rule.source?.title ?? "source").replace(/[*_`[\]]/g, "")}*\n• panjang: ${text.length}\n• media: ${hasMedia(m) ? "ya" : "tidak"}`;
    return [{ method: "sendMessage", payload: { chat_id: target, text: summary, parse_mode: "Markdown", disable_web_page_preview: true, ...base } }];
  }
  if (!hasMedia(m)) {
    return [{ method: "sendMessage", payload: { chat_id: target, text: decorated || transformed || text, disable_web_page_preview: rule.strip_links || undefined, ...base } }];
  }
  return [{ method: "copyMessage", payload: { chat_id: target, from_chat_id: m.chat.id, message_id: m.message_id, caption: decorated || undefined, ...base } }];
}

async function consumeRate(db: SupabaseClient, rule: Rule) {
  const { data, error } = await db.rpc("tg_consume_rate", {
    p_rule_id: rule.id, p_minute_q: rule.quota_per_minute ?? 0,
    p_hour_q: rule.quota_per_hour ?? 0, p_day_q: rule.quota_per_day ?? 0,
    p_cooldown_s: rule.cooldown_seconds ?? 0,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: !!row?.allowed, retry_after_seconds: Number(row?.retry_after_seconds ?? 0) };
}

const bucket = { tokens: 25, last: Date.now(), rps: 25 };
async function globalThrottle() {
  for (;;) {
    const now = Date.now();
    const elapsed = (now - bucket.last) / 1000;
    bucket.tokens = Math.min(bucket.rps, bucket.tokens + elapsed * bucket.rps);
    bucket.last = now;
    if (bucket.tokens >= 1) { bucket.tokens -= 1; return; }
    await new Promise(r => setTimeout(r, 50));
  }
}

async function isAdminUser(db: SupabaseClient, uid: number, env: any) {
  const boot = (env.ADMIN_TELEGRAM_IDS ?? "").split(",").map((s: string) => Number(s.trim())).filter(Boolean);
  if (boot.includes(uid)) return true;
  const { data } = await db.from("tg_admins").select("telegram_user_id").eq("telegram_user_id", uid).maybeSingle();
  return !!data;
}

async function audit(db: SupabaseClient, actor: string, action: string, entity?: string, entity_id?: string, diff?: unknown) {
  await db.from("tg_audit_log").insert({ actor, action, entity, entity_id, diff: diff as any });
}

const MODES: ForwardMode[] = ["native_forward","copy_hide_sender","notify_only","anonymize","media_only","text_only"];

async function handleCommand(db: SupabaseClient, tg: TelegramClient, env: any, m: IncomingMessage): Promise<boolean> {
  const text = m.text?.trim();
  if (!text || !text.startsWith("/")) return false;
  const fromId = m.from?.id ?? 0;
  const admin = await isAdminUser(db, fromId, env);
  const [cmdRaw, ...args] = text.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const reply = (t: string) => tg.sendMessage({ chat_id: m.chat.id, text: t, parse_mode: "Markdown", disable_web_page_preview: true });

  if (cmd === "/whoami") {
    await reply(`🪪 *whoami*\n• user id: \`${fromId}\`\n• chat id: \`${m.chat.id}\`\n• type: \`${m.chat.type ?? "?"}\`\n• admin: \`${admin}\``);
    return true;
  }
  if (!admin) return true;

  try {
    if (cmd === "/help") { await reply("/whoami /addsource /addtarget /addrule /setmode /setcooldown /setquota /setheader /pause /resume /list /queue"); return true; }
    if (cmd === "/addsource") {
      const id = Number(args[0]); const title = args.slice(1).join(" ") || null;
      if (!id) { await reply("usage: /addsource <chat_id> [title]"); return true; }
      const { error } = await db.from("tg_sources").upsert({ chat_id: id, title }, { onConflict: "chat_id" });
      await reply(error ? `❌ ${error.message}` : `✅ source \`${id}\``); if (!error) await audit(db, `tg:${fromId}`, "source.upsert", "tg_sources", String(id));
      return true;
    }
    if (cmd === "/addtarget") {
      const id = Number(args[0]); const title = args.slice(1).join(" ") || null;
      if (!id) { await reply("usage: /addtarget <chat_id> [title]"); return true; }
      const { error } = await db.from("tg_targets").upsert({ chat_id: id, title }, { onConflict: "chat_id" });
      await reply(error ? `❌ ${error.message}` : `✅ target \`${id}\``); return true;
    }
    if (cmd === "/addrule") {
      const [src, tgt, mode] = args;
      if (!src || !tgt) { await reply("usage: /addrule <src> <tgt> [mode]"); return true; }
      const fwd = (MODES.includes(mode as ForwardMode) ? mode : "native_forward") as ForwardMode;
      const { data: s } = await db.from("tg_sources").select("id").eq("chat_id", Number(src)).maybeSingle();
      const { data: t } = await db.from("tg_targets").select("id").eq("chat_id", Number(tgt)).maybeSingle();
      if (!s || !t) { await reply("❌ register source/target first"); return true; }
      const { data: r, error } = await db.from("tg_rules").upsert({ source_id: s.id, target_id: t.id, mode: fwd }, { onConflict: "source_id,target_id" }).select("id").maybeSingle();
      await reply(error ? `❌ ${error.message}` : `✅ rule \`${r?.id}\` (${fwd})`); return true;
    }
    if (cmd === "/setmode") {
      const [id, mode] = args;
      if (!MODES.includes(mode as ForwardMode)) { await reply(`mode: ${MODES.join(", ")}`); return true; }
      const { error } = await db.from("tg_rules").update({ mode }).eq("id", id);
      await reply(error ? `❌ ${error.message}` : `✅ mode → ${mode}`); return true;
    }
    if (cmd === "/setcooldown") {
      const [id, s] = args;
      const { error } = await db.from("tg_rules").update({ cooldown_seconds: Number(s) }).eq("id", id);
      await reply(error ? `❌ ${error.message}` : `✅ cooldown → ${s}s`); return true;
    }
    if (cmd === "/setquota") {
      const [id, kind, n] = args;
      const col = ({ minute: "quota_per_minute", hour: "quota_per_hour", day: "quota_per_day" } as any)[kind];
      if (!col) { await reply("kind: minute|hour|day"); return true; }
      const { error } = await db.from("tg_rules").update({ [col]: Number(n) }).eq("id", id);
      await reply(error ? `❌ ${error.message}` : `✅ ${col} → ${n}`); return true;
    }
    if (cmd === "/setheader") {
      const id = args[0]; const tpl = args.slice(1).join(" ") || null;
      const { error } = await db.from("tg_rules").update({ header_template: tpl }).eq("id", id);
      await reply(error ? `❌ ${error.message}` : "✅ header set"); return true;
    }
    if (cmd === "/pause" || cmd === "/resume") {
      const { error } = await db.from("tg_rules").update({ is_active: cmd === "/resume" }).eq("id", args[0]);
      await reply(error ? `❌ ${error.message}` : `✅ ${cmd === "/resume" ? "resumed" : "paused"}`); return true;
    }
    if (cmd === "/list") {
      const what = args[0] ?? "rules";
      if (what === "sources") {
        const { data } = await db.from("tg_sources").select("chat_id,title,is_active").limit(50);
        await reply("*sources*\n" + (data ?? []).map((s: any) => `• \`${s.chat_id}\` ${s.title ?? ""}`).join("\n"));
      } else if (what === "targets") {
        const { data } = await db.from("tg_targets").select("chat_id,title,is_active").limit(50);
        await reply("*targets*\n" + (data ?? []).map((s: any) => `• \`${s.chat_id}\` ${s.title ?? ""}`).join("\n"));
      } else {
        const { data } = await db.from("tg_rules").select("id,mode,is_active,source:tg_sources(chat_id),target:tg_targets(chat_id)").limit(50);
        await reply("*rules*\n" + (data ?? []).map((r: any) => `• \`${r.id.slice(0,8)}\` ${r.source?.chat_id}→${r.target?.chat_id} ${r.mode}`).join("\n"));
      }
      return true;
    }
    if (cmd === "/queue") {
      const sub = args[0] ?? "status";
      if (sub === "status") {
        const { count: pending } = await db.from("tg_forward_queue").select("*", { count: "exact", head: true }).eq("status", "pending");
        const { count: failed } = await db.from("tg_forward_queue").select("*", { count: "exact", head: true }).eq("status", "failed");
        await reply(`*queue*\n• pending: ${pending}\n• failed: ${failed}`);
      } else if (sub === "flush") {
        const id = args[1];
        const q = id ? db.from("tg_forward_queue").delete().eq("rule_id", id) : db.from("tg_forward_queue").delete().neq("id", 0);
        const { error } = await q;
        await reply(error ? `❌ ${error.message}` : "✅ flushed");
      }
      return true;
    }
    return false;
  } catch (e: any) { await reply(`❌ ${e?.message ?? e}`); return true; }
}

export async function processUpdate(db: SupabaseClient, env: any, update: any) {
  if (env.GLOBAL_RPS) bucket.rps = Number(env.GLOBAL_RPS);
  const tg = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
  const m: IncomingMessage | undefined = update.message ?? update.edited_message ?? update.channel_post ?? update.edited_channel_post;
  if (!m) return { handled: false, matched: 0, sent: 0, queued: 0, dropped: 0 };

  const { error: logErr } = await db.from("tg_message_log").insert({
    update_id: update.update_id, source_chat_id: m.chat.id, source_msg_id: m.message_id, payload: update,
  });
  if (logErr && /duplicate key|already exists/i.test(logErr.message)) {
    return { handled: true, matched: 0, sent: 0, queued: 0, dropped: 0 };
  }

  if (m.from && (await handleCommand(db, tg, env, m))) {
    return { handled: true, matched: 0, sent: 0, queued: 0, dropped: 0 };
  }

  const { data: src } = await db.from("tg_sources").select("id,chat_id,title,is_active").eq("chat_id", m.chat.id).maybeSingle();
  if (!src || !src.is_active) return { handled: true, matched: 0, sent: 0, queued: 0, dropped: 0 };

  const { data: rules } = await db.from("tg_rules")
    .select("*, source:tg_sources(chat_id,title,is_active), target:tg_targets(chat_id,title,is_active)")
    .eq("source_id", src.id).eq("is_active", true).order("priority", { ascending: false });

  let sent = 0, queued = 0, dropped = 0;
  for (const rule of (rules ?? []) as Rule[]) {
    if (!rule.target?.is_active) continue;
    const { data: loop } = await db.from("tg_sources").select("chat_id").eq("chat_id", rule.target.chat_id).maybeSingle();
    if (loop) { dropped++; continue; }
    if (!passesFilter(m, rule)) { dropped++; continue; }
    const rate = await consumeRate(db, rule);
    if (!rate.allowed) {
      if (rule.on_excess === "drop") { dropped++; continue; }
      await db.from("tg_forward_queue").insert({
        rule_id: rule.id, source_chat_id: m.chat.id, source_msg_id: m.message_id,
        target_chat_id: rule.target.chat_id, mode: rule.mode, payload: m as any,
        not_before: new Date(Date.now() + rate.retry_after_seconds * 1000).toISOString(),
      });
      queued++; continue;
    }
    try {
      await globalThrottle();
      const calls = buildCalls(rule, m, rule.target.chat_id);
      for (const c of calls) await tg.call(c.method, c.payload);
      sent++;
    } catch (e: any) {
      await db.from("tg_forward_queue").insert({
        rule_id: rule.id, source_chat_id: m.chat.id, source_msg_id: m.message_id,
        target_chat_id: rule.target.chat_id, mode: rule.mode, payload: m as any,
        not_before: new Date(Date.now() + (Number(e?.retry_after) || 5) * 1000).toISOString(),
      });
      queued++;
    }
  }
  return { handled: true, matched: rules?.length ?? 0, sent, queued, dropped };
}

const MAX_ATTEMPTS = 8;
export async function drainQueue(db: SupabaseClient, tg: TelegramClient, batch = 25) {
  const { data: claims } = await db.from("tg_forward_queue").select("*")
    .eq("status", "pending").lte("not_before", new Date().toISOString())
    .order("not_before", { ascending: true }).limit(batch);
  let sent = 0, failed = 0;
  for (const item of claims ?? []) {
    const { data: locked } = await db.from("tg_forward_queue")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", item.id).eq("status", "pending").select("id").maybeSingle();
    if (!locked) continue;
    try {
      const { data: rule } = await db.from("tg_rules")
        .select("*, source:tg_sources(chat_id,title,is_active), target:tg_targets(chat_id,title,is_active)")
        .eq("id", item.rule_id).maybeSingle();
      if (!rule || !rule.is_active || !rule.target?.is_active) {
        await db.from("tg_forward_queue").update({ status: "dropped", last_error: "rule/target inactive" }).eq("id", item.id); continue;
      }
      await globalThrottle();
      const calls = buildCalls(rule as any, item.payload, item.target_chat_id);
      for (const c of calls) await tg.call(c.method, c.payload);
      await db.from("tg_forward_queue").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", item.id);
      sent++;
    } catch (e: any) {
      const attempts = (item.attempts ?? 0) + 1;
      const retry = Number(e?.retry_after) || Math.min(300, 2 ** attempts);
      await db.from("tg_forward_queue").update({
        status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        attempts, last_error: String(e?.message ?? e).slice(0, 500),
        not_before: new Date(Date.now() + retry * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      failed++;
    }
  }
  return { processed: claims?.length ?? 0, sent, failed };
}