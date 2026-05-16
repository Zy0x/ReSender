// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { TelegramClient, drainQueue } from "../_shared/process.ts";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  const env = {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL")!,
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    TELEGRAM_BOT_TOKEN: Deno.env.get("TELEGRAM_BOT_TOKEN")!,
    CRON_SECRET: Deno.env.get("CRON_SECRET") ?? "",
  };
  if (env.CRON_SECRET) {
    const provided = req.headers.get("x-cron-secret") ?? "";
    if (!safeEqual(provided, env.CRON_SECRET)) return new Response("unauthorized", { status: 401 });
  }
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const tg = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
  const r = await drainQueue(db, tg, 25);
  return Response.json({ ok: true, ...r });
});