// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function — Telegram webhook (alternative runtime).
// Switch to this runtime by running:
//   bun run scripts/set-webhook.ts --target=edge
// Reads env via Deno.env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, ADMIN_TELEGRAM_IDS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processUpdate } from "../_shared/process.ts";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response("ok");
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const env = {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL")!,
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    TELEGRAM_BOT_TOKEN: Deno.env.get("TELEGRAM_BOT_TOKEN")!,
    TELEGRAM_WEBHOOK_SECRET: Deno.env.get("TELEGRAM_WEBHOOK_SECRET")!,
    ADMIN_TELEGRAM_IDS: Deno.env.get("ADMIN_TELEGRAM_IDS") ?? undefined,
    GLOBAL_RPS: Deno.env.get("GLOBAL_RPS") ?? undefined,
  };
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"]) {
    if (!(env as any)[k]) return new Response(`missing env ${k}`, { status: 500 });
  }

  const provided = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(provided, env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }

  const update = await req.json().catch(() => null);
  if (!update) return new Response("bad json", { status: 400 });

  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const r = await processUpdate(db, env, update);
    return Response.json({ ok: true, ...r });
  } catch (e: any) {
    console.error("processUpdate failed", e);
    return Response.json({ ok: false, error: String(e?.message ?? e) });
  }
});