import { Link, Outlet, useRouter, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hasSupabaseConfig, supabase } from "@/lib/tg/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: "📊" },
  { to: "/dashboard/sources", label: "Sumber Pesan", icon: "📥" },
  { to: "/dashboard/targets", label: "Tujuan Pesan", icon: "🎯" },
  { to: "/dashboard/rules", label: "Aturan Forward", icon: "⚙️" },
  { to: "/dashboard/queue", label: "Antrian", icon: "⏳" },
  { to: "/dashboard/logs", label: "Riwayat", icon: "📝" },
  { to: "/dashboard/settings", label: "Pengaturan", icon: "🔧" },
] as const;

export function DashboardShell() {
  const router = useRouter();
  const location = useLocation();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setEmail(session?.user?.email ?? null);
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        router.invalidate();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!hasSupabaseConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 animate-in-fade">
        <div className="glass-card rounded-2xl p-8 max-w-lg space-y-4 text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">ReSender</h1>
          <p className="text-muted-foreground">
            Set <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> di file{" "}
            <code>.env</code> proyek ini, lalu reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground selection:bg-primary/20">
      {/* Sidebar Glassmorphism */}
      <aside className="w-64 border-r border-white/5 dark:border-white/5 glass hidden md:flex flex-col gap-2 relative z-20 shadow-2xl">
        <div className="px-6 pt-8 pb-6 border-b border-border/50">
          <div className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent flex items-center gap-2">
            🚀 ReSender
          </div>
          <div className="text-xs font-medium text-muted-foreground mt-2 truncate bg-muted/50 px-2 py-1 rounded-md border border-border/50">{email ?? "—"}</div>
        </div>
        
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((n) => {
            const isActive = n.to === "/dashboard" 
              ? location.pathname === "/dashboard" 
              : location.pathname.startsWith(n.to);
              
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 translate-x-1" 
                  : "hover:bg-accent/50 text-foreground/80 hover:text-foreground"
                }`}
              >
                <span className="text-lg">{n.icon}</span>
                {n.label}
              </Link>
            )
          })}
        </div>
        
        <div className="p-4 mt-auto border-t border-border/50 bg-background/30">
          <Button
            variant="outline"
            className="w-full justify-center gap-2 rounded-xl border-white/10 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors"
            onClick={async () => {
              await supabase.auth.signOut();
              router.navigate({ to: "/login" });
            }}
          >
            👋 Keluar
          </Button>
        </div>
      </aside>
      
      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-auto relative z-10">
        <div className="max-w-6xl mx-auto w-full animate-in-slide pb-20">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
