import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/tg/client";

export const Route = createFileRoute("/dashboard/")({ component: Overview });

function Overview() {
  const [stats, setStats] = useState<{ sources?: number; targets?: number; rules?: number; pending?: number; failed?: number }>({});
  
  useEffect(() => {
    (async () => {
      const [s, t, r, p, f] = await Promise.all([
        supabase.from("tg_sources").select("*", { count: "exact", head: true }),
        supabase.from("tg_targets").select("*", { count: "exact", head: true }),
        supabase.from("tg_rules").select("*", { count: "exact", head: true }),
        supabase.from("tg_forward_queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("tg_forward_queue").select("*", { count: "exact", head: true }).eq("status", "failed"),
      ]);
      setStats({ sources: s.count ?? 0, targets: t.count ?? 0, rules: r.count ?? 0, pending: p.count ?? 0, failed: f.count ?? 0 });
    })();
  }, []);

  const cards = [
    { label: "Sumber Pesan", icon: "📥", value: stats.sources, link: "/dashboard/sources", color: "from-blue-500/20 to-blue-500/5", text: "text-blue-500" },
    { label: "Tujuan Pesan", icon: "🎯", value: stats.targets, link: "/dashboard/targets", color: "from-purple-500/20 to-purple-500/5", text: "text-purple-500" },
    { label: "Aturan Aktif", icon: "⚙️", value: stats.rules, link: "/dashboard/rules", color: "from-emerald-500/20 to-emerald-500/5", text: "text-emerald-500" },
    { label: "Antrian (Pending)", icon: "⏳", value: stats.pending, link: "/dashboard/queue", color: "from-amber-500/20 to-amber-500/5", text: "text-amber-500" },
    { label: "Gagal Dikirim", icon: "❌", value: stats.failed, link: "/dashboard/queue", color: "from-red-500/20 to-red-500/5", text: "text-red-500" },
  ];

  return (
    <div className="space-y-8 animate-in-slide">
      <div className="glass-card p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">Selamat Datang di ReSender</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Sistem otomatisasi penerus pesan Telegram tercepat dan teraman. Pantau performa bot dan kelola aliran pesan Anda dari satu dasbor yang elegan.
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">📊 Ringkasan Sistem</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map((c) => (
            <Link 
              to={c.link} 
              key={c.label} 
              className={`glass-card rounded-2xl p-6 relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] transition-all bg-gradient-to-br ${c.color}`}
            >
              <div className="absolute top-0 right-0 p-4 opacity-20 text-4xl group-hover:scale-125 transition-transform duration-500">{c.icon}</div>
              <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 relative z-10">{c.label}</div>
              <div className={`text-5xl font-bold mt-1 relative z-10 ${c.text}`}>
                {c.value === undefined ? "—" : c.value}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">🚀 Memulai Cepat</h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center shrink-0">1</span>
              <span>Daftarkan <strong>Sumber Pesan</strong> (grup/channel asal) di menu Sumber.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center shrink-0">2</span>
              <span>Daftarkan <strong>Tujuan Pesan</strong> tempat bot mengirimkan pesannya.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center shrink-0">3</span>
              <span>Buat <strong>Aturan Forward</strong> untuk menghubungkan sumber dan tujuan.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="bg-primary/20 text-primary w-6 h-6 rounded-full flex items-center justify-center shrink-0">4</span>
              <span>Bot akan otomatis meneruskan pesan sesuai aturan yang aktif.</span>
            </li>
          </ul>
        </div>
        
        <div className="glass-card rounded-2xl p-6 bg-primary/5 border-primary/20">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-primary">💡 Tips Penggunaan</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Anda juga dapat berinteraksi dengan bot langsung dari Telegram. Kirimkan pesan ke bot Anda dan ketik:
          </p>
          <div className="bg-background/80 rounded-xl p-4 font-mono text-sm shadow-inner">
            <div className="text-primary font-bold">/bantuan</div>
            <div className="text-muted-foreground mt-1">Untuk melihat daftar semua perintah yang tersedia.</div>
            
            <div className="text-primary font-bold mt-3">/antrian</div>
            <div className="text-muted-foreground mt-1">Mengecek jika ada pesan yang gagal terkirim.</div>
          </div>
        </div>
      </div>
    </div>
  );
}