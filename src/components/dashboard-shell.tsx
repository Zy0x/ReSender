import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hasSupabaseConfig, supabase } from "@/lib/tg/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Overview" },
  { to: "/dashboard/sources", label: "Sources" },
  { to: "/dashboard/targets", label: "Targets" },
  { to: "/dashboard/rules", label: "Rules" },
  { to: "/dashboard/queue", label: "Queue" },
  { to: "/dashboard/logs", label: "Logs" },
  { to: "/dashboard/settings", label: "Settings" },
] as const;

export function DashboardShell() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
      router.invalidate();
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!hasSupabaseConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg space-y-3">
          <h1 className="text-2xl font-semibold">Konfigurasi belum lengkap</h1>
          <p className="text-muted-foreground text-sm">
            Set <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> di file{" "}
            <code>.env</code> proyek ini, lalu reload.
          </p>
          <p className="text-muted-foreground text-sm">
            Lihat <code>.env.example</code> untuk daftar lengkap.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-60 border-r border-border p-4 hidden md:flex flex-col gap-1">
        <div className="px-2 pb-4">
          <div className="text-sm font-semibold">TG Forwarder</div>
          <div className="text-xs text-muted-foreground truncate">{email ?? "—"}</div>
        </div>
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/dashboard" }}
            className="px-3 py-2 rounded text-sm hover:bg-accent"
            activeProps={{ className: "px-3 py-2 rounded text-sm bg-accent font-medium" }}
          >
            {n.label}
          </Link>
        ))}
        <div className="mt-auto pt-4">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={async () => {
              await supabase.auth.signOut();
              router.navigate({ to: "/login" });
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
