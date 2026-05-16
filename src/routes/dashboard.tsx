import { createFileRoute, redirect } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard-shell";
import { hasSupabaseConfig, supabase } from "@/lib/tg/client";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    if (typeof window === "undefined" || !hasSupabaseConfig) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
    const res = await fetch("/api/admin/me", {
      headers: { authorization: `Bearer ${data.session.access_token}` },
    });
    if (!res.ok) throw redirect({ to: "/login" });
    const payload = (await res.json()) as { isAdmin?: boolean };
    if (!payload.isAdmin) throw redirect({ to: "/login" });
  },
  component: DashboardShell,
});
