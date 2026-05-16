import { createFileRoute } from "@tanstack/react-router";
import { getAppRole, makeServiceClient, requireSupabaseUser } from "@/lib/admin-auth.server";
import { publicConfigErrorResponse, readAdminBootstrapEnv, safeEqual } from "@/lib/tg/env.server";

export const Route = createFileRoute("/api/admin/bootstrap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let env;
        try {
          env = readAdminBootstrapEnv();
        } catch (error) {
          console.error("admin bootstrap config error", error);
          return publicConfigErrorResponse();
        }

        const provided = request.headers.get("x-admin-bootstrap-secret") ?? "";
        if (!safeEqual(provided, env.ADMIN_BOOTSTRAP_SECRET)) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }

        const db = makeServiceClient(env);
        const user = await requireSupabaseUser(db, request);
        if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

        try {
          const currentRole = await getAppRole(db, user.id);
          if (currentRole === "admin") {
            return Response.json({ ok: true, role: "admin", alreadyAdmin: true });
          }

          const { count, error: countError } = await db
            .from("app_users")
            .select("*", { count: "exact", head: true })
            .eq("role", "admin");
          if (countError) throw countError;
          if ((count ?? 0) > 0) {
            return Response.json({ ok: false, error: "admin already exists" }, { status: 409 });
          }

          const { error } = await db.from("app_users").insert({
            user_id: user.id,
            role: "admin",
          });
          if (error) throw error;

          await db.from("tg_audit_log").insert({
            actor: `auth:${user.id}`,
            action: "admin.bootstrap",
            entity: "app_users",
            entity_id: user.id,
            diff: { email: user.email ?? null },
          });

          return Response.json({ ok: true, role: "admin", bootstrapped: true });
        } catch (error) {
          console.error("admin bootstrap failed", error);
          return Response.json({ ok: false, error: "admin bootstrap failed" }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: false, error: "method not allowed" }, { status: 405 }),
    },
  },
});
