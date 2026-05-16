import { createFileRoute } from "@tanstack/react-router";
import { readHealthEnv } from "@/lib/tg/env.server";
import { makeAdmin } from "@/lib/tg/db";

export const Route = createFileRoute("/api/public/tg/healthz")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const env = readHealthEnv();
          const db = makeAdmin(env);
          const { error } = await db
            .from("tg_sources")
            .select("id", { head: true, count: "exact" })
            .limit(1);
          if (error) {
            console.error("healthz database check failed", error);
            return Response.json({ ok: false, status: "unhealthy" }, { status: 500 });
          }
          return Response.json({
            ok: true,
            runtime: "tanstack-workers",
            checks: { config: "ok", database: "ok" },
            time: new Date().toISOString(),
          });
        } catch (e: any) {
          console.error("healthz failed", e);
          return Response.json({ ok: false, status: "unhealthy" }, { status: 500 });
        }
      },
      POST: async () => Response.json({ ok: false, error: "method not allowed" }, { status: 405 }),
    },
  },
});
