import { createFileRoute } from "@tanstack/react-router";
import { readEnv, safeEqual } from "@/lib/tg/env.server";
import { makeAdmin } from "@/lib/tg/db";
import { TelegramClient } from "@/lib/tg/telegram";
import { drainQueue } from "@/lib/tg/queue";

export const Route = createFileRoute("/api/public/tg/process-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = readEnv();
        if (env.CRON_SECRET) {
          const provided = request.headers.get("x-cron-secret") ?? "";
          if (!safeEqual(provided, env.CRON_SECRET)) {
            return new Response("unauthorized", { status: 401 });
          }
        }
        const db = makeAdmin(env);
        const tg = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
        const r = await drainQueue(db, tg, 25);
        return Response.json({ ok: true, ...r });
      },
      GET: async () => new Response("method not allowed", { status: 405 }),
    },
  },
});