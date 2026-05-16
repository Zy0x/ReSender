import { createFileRoute } from "@tanstack/react-router";
import { readEnv, safeEqual } from "@/lib/tg/env.server";
import { makeAdmin } from "@/lib/tg/db";
import { processUpdate } from "@/lib/tg/process";

export const Route = createFileRoute("/api/public/tg/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let env;
        try { env = readEnv(); } catch (e: any) {
          return new Response(`config error: ${e.message}`, { status: 500 });
        }
        const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(provided, env.TELEGRAM_WEBHOOK_SECRET)) {
          return new Response("unauthorized", { status: 401 });
        }
        let update: any;
        try { update = await request.json(); } catch {
          return new Response("bad json", { status: 400 });
        }
        const db = makeAdmin(env);
        // ack fast; do work synchronously but bail quickly on error
        try {
          const r = await processUpdate(db, env, update);
          return Response.json({ ok: true, ...r });
        } catch (e: any) {
          console.error("processUpdate failed:", e);
          // still ack 200 so Telegram doesn't retry-storm; we logged it
          return Response.json({ ok: false, error: String(e?.message ?? e) });
        }
      },
      GET: async () => new Response("method not allowed", { status: 405 }),
    },
  },
});