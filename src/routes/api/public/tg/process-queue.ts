import { createFileRoute } from "@tanstack/react-router";
import {
  getQueueBatchSize,
  publicConfigErrorResponse,
  readQueueEnv,
  safeEqual,
} from "@/lib/tg/env.server";
import { makeAdmin } from "@/lib/tg/db";
import { TelegramClient } from "@/lib/tg/telegram";
import { drainQueue } from "@/lib/tg/queue";

export const Route = createFileRoute("/api/public/tg/process-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let env;
        try {
          env = readQueueEnv();
        } catch (error) {
          console.error("queue drain config error", error);
          return publicConfigErrorResponse();
        }
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!safeEqual(provided, env.CRON_SECRET)) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        const db = makeAdmin(env);
        const tg = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
        try {
          const r = await drainQueue(db, tg, getQueueBatchSize(env));
          return Response.json({ ok: true, ...r });
        } catch (error) {
          console.error("queue drain failed", error);
          return Response.json({ ok: false, error: "queue drain failed" }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: false, error: "method not allowed" }, { status: 405 }),
    },
  },
});
