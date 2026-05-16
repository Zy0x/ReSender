import type { SupabaseClient } from "@supabase/supabase-js";
import type { Rule } from "./types";

export interface RateResult { allowed: boolean; retry_after_seconds: number; }

export async function consumeRate(db: SupabaseClient, rule: Rule): Promise<RateResult> {
  const { data, error } = await db.rpc("tg_consume_rate", {
    p_rule_id: rule.id,
    p_minute_q: rule.quota_per_minute ?? 0,
    p_hour_q: rule.quota_per_hour ?? 0,
    p_day_q: rule.quota_per_day ?? 0,
    p_cooldown_s: rule.cooldown_seconds ?? 0,
  });
  if (error) throw new Error(`consumeRate rpc failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: !!row?.allowed,
    retry_after_seconds: Number(row?.retry_after_seconds ?? 0),
  };
}

/** Best-effort in-memory global throttle per isolate. */
const globalBucket = { tokens: 25, last: Date.now(), rps: 25 };
export function setGlobalRps(rps: number) { globalBucket.rps = rps; globalBucket.tokens = rps; }
export async function globalThrottle(): Promise<void> {
  for (;;) {
    const now = Date.now();
    const elapsed = (now - globalBucket.last) / 1000;
    globalBucket.tokens = Math.min(globalBucket.rps, globalBucket.tokens + elapsed * globalBucket.rps);
    globalBucket.last = now;
    if (globalBucket.tokens >= 1) { globalBucket.tokens -= 1; return; }
    await new Promise((r) => setTimeout(r, 50));
  }
}