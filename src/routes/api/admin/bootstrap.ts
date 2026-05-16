import { createFileRoute } from "@tanstack/react-router";
import { isOwnerAdminEmail, makeServiceClient, requireSupabaseUser } from "@/lib/admin-auth.server";
import {
  publicConfigErrorResponse,
  readAdminAuthEnv,
  readAdminBootstrapEnv,
  safeEqual,
} from "@/lib/tg/env.server";

export const Route = createFileRoute("/api/admin/bootstrap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let authEnv;
        try {
          authEnv = readAdminAuthEnv();
        } catch (error) {
          console.error("admin bootstrap config error", error);
          return publicConfigErrorResponse();
        }
        const db = makeServiceClient(authEnv);
        const user = await requireSupabaseUser(db, request);
        if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

        try {
          const { count, error: countError } = await db
            .from("app_users")
            .select("*", { count: "exact", head: true })
            .eq("role", "admin");
          if (countError) throw countError;
          if ((count ?? 0) > 0) {
            return Response.json({ ok: false, error: "bootstrap disabled" }, { status: 409 });
          }

          let bootstrapEnv;
          try {
            bootstrapEnv = readAdminBootstrapEnv();
          } catch (error) {
            console.error("admin bootstrap owner config error", error);
            return publicConfigErrorResponse();
          }

          const provided = request.headers.get("x-admin-bootstrap-secret") ?? "";
          if (!isOwnerAdminEmail(user.email, bootstrapEnv.ADMIN_ACCOUNT)) {
            return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
          }

          if (!safeEqual(provided, bootstrapEnv.ADMIN_BOOTSTRAP_SECRET)) {
            return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
          }

          const { error } = await db.from("app_users").insert({
            user_id: user.id,
            role: "admin",
          });
          if (error) throw error;

          const { error: ownerError } = await db.from("app_owner").upsert({
            singleton: true,
            user_id: user.id,
          }, { onConflict: "singleton" });
          if (ownerError) throw ownerError;

          await db.from("tg_audit_log").insert({
            actor: `auth:${user.id}`,
            action: "admin.bootstrap",
            entity: "app_owner",
            entity_id: user.id,
            diff: { email: user.email ?? null, ownerEmailMatched: true },
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
