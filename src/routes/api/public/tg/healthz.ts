import { createFileRoute } from "@tanstack/react-router";
import { readEnv } from "@/lib/tg/env.server";
import { makeAdmin } from "@/lib/tg/db";

export const Route = createFileRoute("/api/public/tg/healthz")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const env = readEnv();
          const db = makeAdmin(env);
          const { error } = await db.from("tg_sources").select("id", { head: true, count: "exact" }).limit(1);
          if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
          return Response.json({ ok: true, runtime: "tanstack-workers", time: new Date().toISOString() });
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
    },
  },
});