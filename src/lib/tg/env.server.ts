import type { Env } from "./types";

/** Read env at request time. Cloudflare Workers injects env per-request. */
export function readEnv(): Env {
  const e = process.env as Record<string, string | undefined>;
  // Allow either TG_SUPABASE_* (preferred for non-Lovable-Cloud projects)
  // or SUPABASE_* (when Lovable Cloud injects them).
  const supaUrl = e.TG_SUPABASE_URL ?? e.SUPABASE_URL;
  const supaKey = e.TG_SUPABASE_SERVICE_ROLE_KEY ?? e.SUPABASE_SERVICE_ROLE_KEY;
  const required: Record<string, string | undefined> = {
    SUPABASE_URL: supaUrl,
    SUPABASE_SERVICE_ROLE_KEY: supaKey,
    TELEGRAM_BOT_TOKEN: e.TELEGRAM_BOT_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: e.TELEGRAM_WEBHOOK_SECRET,
  };
  for (const [k, v] of Object.entries(required)) {
    if (!v) throw new Error(`missing env: ${k} (or TG_${k} for Supabase ones)`);
  }
  return {
    SUPABASE_URL: supaUrl!,
    SUPABASE_SERVICE_ROLE_KEY: supaKey!,
    TELEGRAM_BOT_TOKEN: e.TELEGRAM_BOT_TOKEN!,
    TELEGRAM_WEBHOOK_SECRET: e.TELEGRAM_WEBHOOK_SECRET!,
    ADMIN_TELEGRAM_IDS: e.ADMIN_TELEGRAM_IDS,
    CRON_SECRET: e.CRON_SECRET,
    GLOBAL_RPS: e.GLOBAL_RPS,
  };
}

/** Constant-time string compare. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}