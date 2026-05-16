import type { Env } from "./types";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

type EnvKey = keyof Env;

function readBaseEnv(): Partial<Env> {
  const e = process.env as Record<string, string | undefined>;
  const supaUrl = e.TG_SUPABASE_URL ?? e.SUPABASE_URL;
  const supaKey = e.TG_SUPABASE_SERVICE_ROLE_KEY ?? e.SUPABASE_SERVICE_ROLE_KEY;

  return {
    SUPABASE_URL: supaUrl,
    SUPABASE_SERVICE_ROLE_KEY: supaKey,
    TELEGRAM_BOT_TOKEN: e.TELEGRAM_BOT_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: e.TELEGRAM_WEBHOOK_SECRET,
    ADMIN_TELEGRAM_IDS: e.ADMIN_TELEGRAM_IDS,
    ADMIN_BOOTSTRAP_SECRET: e.ADMIN_BOOTSTRAP_SECRET,
    CRON_SECRET: e.CRON_SECRET,
    GLOBAL_RPS: e.GLOBAL_RPS,
    QUEUE_BATCH_SIZE: e.QUEUE_BATCH_SIZE,
  };
}

function requireEnv(env: Partial<Env>, keys: EnvKey[]): Env {
  for (const key of keys) {
    if (!env[key]) throw new ConfigError(`Missing required server configuration: ${key}`);
  }
  return env as Env;
}

/** Read env for the Telegram webhook runtime. */
export function readWebhookEnv(): Env {
  return requireEnv(readBaseEnv(), [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
  ]);
}

/** Read env for queue drain. This must fail closed when CRON_SECRET is missing. */
export function readQueueEnv(): Env & { CRON_SECRET: string } {
  return requireEnv(readBaseEnv(), [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TELEGRAM_BOT_TOKEN",
    "CRON_SECRET",
  ]) as Env & { CRON_SECRET: string };
}

/** Read env for health checks without requiring Telegram webhook-specific secrets. */
export function readHealthEnv(): Env {
  return requireEnv(readBaseEnv(), [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
    "CRON_SECRET",
  ]);
}

export function readAdminBootstrapEnv(): Env & { ADMIN_BOOTSTRAP_SECRET: string } {
  return requireEnv(readBaseEnv(), [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_BOOTSTRAP_SECRET",
  ]) as Env & { ADMIN_BOOTSTRAP_SECRET: string };
}

export function readAdminAuthEnv(): Env {
  return requireEnv(readBaseEnv(), ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
}

/** Backward-compatible webhook env reader for shared runtime code. */
export function readEnv(): Env {
  return readWebhookEnv();
}

export function getQueueBatchSize(env: Pick<Env, "QUEUE_BATCH_SIZE">, fallback = 25): number {
  const parsed = Number(env.QUEUE_BATCH_SIZE ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(parsed)));
}

export function publicConfigErrorResponse(): Response {
  return Response.json({ ok: false, error: "server configuration error" }, { status: 500 });
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
