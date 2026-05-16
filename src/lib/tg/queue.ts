import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rule } from "./types";
import type { IncomingMessage } from "./transform";
import { TelegramClient } from "./telegram";
import { buildCalls } from "./transform";
import { globalThrottle } from "./ratelimit";

const MAX_ATTEMPTS = 8;
const PROCESSING_STALE_MS = 10 * 60 * 1000;

export async function enqueue(
  db: SupabaseClient,
  rule: Rule,
  m: IncomingMessage,
  not_before_seconds = 0,
) {
  const not_before = new Date(Date.now() + not_before_seconds * 1000).toISOString();
  await db.from("tg_forward_queue").insert({
    rule_id: rule.id,
    source_chat_id: m.chat.id,
    source_msg_id: m.message_id,
    target_chat_id: rule.target!.chat_id,
    mode: rule.mode,
    payload: m as any,
    not_before,
  });
}

/**
 * Drain up to `batch` queue items. Designed to be called from a cron endpoint.
 * Uses optimistic locking via status update to avoid double-processing.
 */
export async function drainQueue(
  db: SupabaseClient,
  tg: TelegramClient,
  batch = 25,
): Promise<{ processed: number; sent: number; failed: number }> {
  await db
    .from("tg_forward_queue")
    .update({
      status: "pending",
      last_error: "recovered stale processing row",
      not_before: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("status", "processing")
    .lt("updated_at", new Date(Date.now() - PROCESSING_STALE_MS).toISOString());

  const { data: claims, error } = await db
    .from("tg_forward_queue")
    .select("*")
    .eq("status", "pending")
    .lte("not_before", new Date().toISOString())
    .order("not_before", { ascending: true })
    .limit(batch);
  if (error) throw new Error(error.message);

  let sent = 0,
    failed = 0;
  for (const item of claims ?? []) {
    // claim row
    const { data: locked } = await db
      .from("tg_forward_queue")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!locked) continue; // lost race

    try {
      // We need the rule (joined source/target) at delivery time
      const { data: rule } = await db
        .from("tg_rules")
        .select(
          "*, source:tg_sources(chat_id,title,is_active), target:tg_targets(chat_id,title,is_active)",
        )
        .eq("id", item.rule_id)
        .maybeSingle();
      if (!rule || !rule.is_active || !rule.target?.is_active) {
        await db
          .from("tg_forward_queue")
          .update({ status: "dropped", last_error: "rule/target inactive" })
          .eq("id", item.id);
        continue;
      }
      await globalThrottle();
      const calls = buildCalls(rule as any, item.payload as IncomingMessage, item.target_chat_id);
      for (const c of calls) await tg.call(c.method, c.payload);
      await db
        .from("tg_forward_queue")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", item.id);
      sent++;
    } catch (e: any) {
      const attempts = (item.attempts ?? 0) + 1;
      const retry_after = Number(e?.retry_after) || Math.min(60 * 5, 2 ** attempts);
      const status = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
      await db
        .from("tg_forward_queue")
        .update({
          status,
          attempts,
          last_error: String(e?.message ?? e).slice(0, 500),
          not_before: new Date(Date.now() + retry_after * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      failed++;
    }
  }
  return { processed: claims?.length ?? 0, sent, failed };
}
