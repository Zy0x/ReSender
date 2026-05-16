import { createFileRoute } from "@tanstack/react-router";
import { publicConfigErrorResponse, readWebhookEnv, safeEqual } from "@/lib/tg/env.server";
import { makeAdmin } from "@/lib/tg/db";
import { processUpdate } from "@/lib/tg/process";

export const Route = createFileRoute("/api/public/tg/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let env;
        try {
          env = readWebhookEnv();
        } catch (error) {
          console.error("telegram webhook config error", error);
          return publicConfigErrorResponse();
        }
        const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(provided, env.TELEGRAM_WEBHOOK_SECRET)) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }
        let update: any;
        try {
          update = await request.json();
        } catch {
          return Response.json({ ok: false, error: "bad json" }, { status: 400 });
        }
        const db = makeAdmin(env);
        try {
          const r = await processUpdate(db, env, update);
          return Response.json({ ok: true, ...r });
        } catch (e: any) {
          console.error("processUpdate failed", e);
          return Response.json({ ok: false, error: "telegram update processing failed" });
        }
      },
      GET: async () => Response.json({ ok: false, error: "method not allowed" }, { status: 405 }),
    },
  },
});
