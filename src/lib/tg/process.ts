import type { SupabaseClient } from "@supabase/supabase-js";
import { TelegramClient } from "./telegram";
import type { Env, Rule } from "./types";
import { handleCommand } from "./commands";
import { passesFilter, buildCalls, type IncomingMessage } from "./transform";
import { consumeRate, globalThrottle, setGlobalRps } from "./ratelimit";
import { enqueue } from "./queue";

/** Telegram update root */
interface Update {
  update_id: number;
  message?: IncomingMessage;
  edited_message?: IncomingMessage;
  channel_post?: IncomingMessage;
  edited_channel_post?: IncomingMessage;
}

function pickMessage(u: Update): IncomingMessage | undefined {
  return u.message ?? u.edited_message ?? u.channel_post ?? u.edited_channel_post;
}

export async function processUpdate(
  db: SupabaseClient,
  env: Env,
  update: Update,
): Promise<{ handled: boolean; matched: number; sent: number; queued: number; dropped: number }> {
  const tg = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
  if (env.GLOBAL_RPS) setGlobalRps(Number(env.GLOBAL_RPS));

  // 1. idempotency log
  const m = pickMessage(update);
  if (!m) return { handled: false, matched: 0, sent: 0, queued: 0, dropped: 0 };

  const { error: logErr } = await db.from("tg_message_log").insert({
    update_id: update.update_id,
    source_chat_id: m.chat.id,
    source_msg_id: m.message_id,
    payload: update as any,
  });
  if (logErr && !/duplicate key|already exists/i.test(logErr.message)) {
    // log but continue
    console.warn("message_log insert failed:", logErr.message);
  } else if (logErr) {
    // duplicate update — skip
    return { handled: true, matched: 0, sent: 0, queued: 0, dropped: 0 };
  }

  // 2. command handling (admin)
  if (m.from && (await handleCommand(db, tg, env, m))) {
    return { handled: true, matched: 0, sent: 0, queued: 0, dropped: 0 };
  }

  // 3. find rules whose source matches this chat
  const { data: src } = await db
    .from("tg_sources")
    .select("id,chat_id,title,is_active")
    .eq("chat_id", m.chat.id)
    .maybeSingle();
  if (!src || !src.is_active) {
    return { handled: true, matched: 0, sent: 0, queued: 0, dropped: 0 };
  }

  const { data: rules } = await db
    .from("tg_rules")
    .select("*, source:tg_sources(chat_id,title,is_active), target:tg_targets(chat_id,title,is_active)")
    .eq("source_id", src.id)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  let sent = 0, queued = 0, dropped = 0;
  for (const rule of (rules ?? []) as Rule[]) {
    if (!rule.target?.is_active) continue;
    // anti-loop
    const { data: loop } = await db.from("tg_sources").select("chat_id").eq("chat_id", rule.target.chat_id).maybeSingle();
    if (loop) { dropped++; continue; }

    const filter = passesFilter(m, rule);
    if (!filter.ok) { dropped++; continue; }

    const rate = await consumeRate(db, rule);
    if (!rate.allowed) {
      if (rule.on_excess === "drop") { dropped++; continue; }
      await enqueue(db, rule, m, rate.retry_after_seconds);
      queued++; continue;
    }

    try {
      await globalThrottle();
      const calls = buildCalls(rule, m, rule.target.chat_id);
      for (const c of calls) await tg.call(c.method, c.payload);
      sent++;
    } catch (e: any) {
      // soft-fall to queue with backoff
      await enqueue(db, rule, m, Number(e?.retry_after) || 5);
      queued++;
    }
  }

  return { handled: true, matched: rules?.length ?? 0, sent, queued, dropped };
}