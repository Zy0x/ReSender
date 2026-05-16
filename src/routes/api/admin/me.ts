import { createFileRoute } from "@tanstack/react-router";
import { getAppRole, makeServiceClient, requireSupabaseUser } from "@/lib/admin-auth.server";
import { publicConfigErrorResponse, readAdminAuthEnv } from "@/lib/tg/env.server";

export const Route = createFileRoute("/api/admin/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        let env;
        try {
          env = readAdminAuthEnv();
        } catch (error) {
          console.error("admin auth config error", error);
          return publicConfigErrorResponse();
        }

        const db = makeServiceClient(env);
        const user = await requireSupabaseUser(db, request);
        if (!user) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

        try {
          const role = await getAppRole(db, user.id);
          return Response.json({
            ok: true,
            user: { id: user.id, email: user.email ?? null },
            role,
            isAdmin: role === "admin",
          });
        } catch (error) {
          console.error("admin role lookup failed", error);
          return Response.json({ ok: false, error: "admin role lookup failed" }, { status: 500 });
        }
      },
      POST: async () => Response.json({ ok: false, error: "method not allowed" }, { status: 405 }),
    },
  },
});
