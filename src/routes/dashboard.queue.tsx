import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/tg/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/dashboard/queue")({
  component: QueuePage,
});

type QueueItem = {
  id: number;
  rule_id: string | null;
  source_chat_id: number | null;
  source_msg_id: number | null;
  target_chat_id: number | null;
  mode: string | null;
  attempts: number;
  last_error: string | null;
  status: string;
  not_before: string;
  created_at: string;
  updated_at: string;
};

type Stats = {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  dropped: number;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "default",
  processing: "outline",
  sent: "secondary",
  failed: "destructive",
  dropped: "secondary",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "⏳ Menunggu",
  processing: "🔄 Diproses",
  sent: "✅ Terkirim",
  failed: "❌ Gagal",
  dropped: "🗑️ Dibuang",
};

function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, processing: 0, sent: 0, failed: 0, dropped: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
  const [err, setErr] = useState<string | null>(null);
  const [flushConfirm, setFlushConfirm] = useState(false);
  const [retryConfirm, setRetryConfirm] = useState<number | null>(null);
  const [cronSecret, setCronSecret] = useState("");
  const [draining, setDraining] = useState(false);
  const [drainResult, setDrainResult] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const statuses = ["pending", "processing", "sent", "failed", "dropped"];
    const counts: Partial<Stats> = {};
    await Promise.all(
      statuses.map(async (s) => {
        const { count } = await supabase
          .from("tg_forward_queue")
          .select("*", { count: "exact", head: true })
          .eq("status", s);
        counts[s as keyof Stats] = count ?? 0;
      }),
    );
    setStats(counts as Stats);
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tg_forward_queue")
      .select("*")
      .eq("status", filter)
      .order("not_before", { ascending: true })
      .limit(50);
    if (error) setErr(error.message);
    else setItems(data as QueueItem[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    loadStats();
    loadItems();
  }, [loadStats, loadItems]);

  async function retryItem(id: number) {
    await supabase
      .from("tg_forward_queue")
      .update({ status: "pending", attempts: 0, last_error: null, not_before: new Date().toISOString() })
      .eq("id", id);
    setRetryConfirm(null);
    loadStats();
    loadItems();
  }

  async function flushFailed() {
    const { error } = await supabase
      .from("tg_forward_queue")
      .update({ status: "pending", attempts: 0, last_error: null, not_before: new Date().toISOString() })
      .eq("status", "failed");
    if (error) setErr(error.message);
    setFlushConfirm(false);
    loadStats();
    loadItems();
  }

  async function drainQueue() {
    setDraining(true);
    setDrainResult(null);
    setErr(null);
    try {
      const res = await fetch("/api/public/tg/process-queue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cron-secret": cronSecret,
        },
        body: "{}",
      });
      const json = await res.json();
      setDrainResult(JSON.stringify(json, null, 2));
    } catch (e: any) {
      setErr(e.message);
    }
    setDraining(false);
    loadStats();
    loadItems();
  }

  const statCards = [
    { label: "Menunggu", key: "pending", color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/10" },
    { label: "Diproses", key: "processing", color: "text-yellow-500 dark:text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "Terkirim", key: "sent", color: "text-green-500 dark:text-green-400", bg: "bg-green-500/10" },
    { label: "Gagal", key: "failed", color: "text-red-500 dark:text-red-400", bg: "bg-red-500/10" },
    { label: "Dibuang", key: "dropped", color: "text-gray-500 dark:text-gray-400", bg: "bg-gray-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-2xl">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Antrian Pesan</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Pantau pesan yang sedang diproses, antrian tunda karena limit, dan pesan yang gagal terkirim. Anda dapat mengulang (retry) pesan yang gagal dari sini.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {statCards.map((c) => (
          <button
            key={c.key}
            id={`queue-filter-${c.key}`}
            onClick={() => setFilter(c.key)}
            className={`glass-card rounded-2xl p-5 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
              filter === c.key ? "ring-2 ring-primary shadow-lg shadow-primary/20 bg-background/80" : "opacity-80 hover:opacity-100"
            }`}
          >
            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">{c.label}</div>
            <div className={`text-4xl font-bold ${c.color}`}>
              {stats[c.key as keyof Stats]}
            </div>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="glass-card p-6 rounded-2xl flex flex-wrap gap-4 items-end">
        <div className="space-y-2 flex-1 min-w-[200px]">
          <Label htmlFor="cron-secret-input" className="font-semibold text-primary">Kunci Rahasia (CRON_SECRET)</Label>
          <Input
            id="cron-secret-input"
            type="password"
            className="w-full rounded-xl bg-background/50 focus-visible:ring-primary/50"
            placeholder="Masukkan CRON_SECRET untuk memicu manual"
            value={cronSecret}
            onChange={(e) => setCronSecret(e.target.value)}
          />
        </div>
        <Button
          id="btn-drain-queue"
          type="button"
          size="lg"
          className="rounded-xl"
          disabled={!cronSecret || draining}
          onClick={drainQueue}
        >
          {draining ? "⏳ Memproses Antrian..." : "🚀 Jalankan Antrian Sekarang"}
        </Button>
        {stats.failed > 0 && filter === "failed" && (
          <Button type="button" variant="destructive" size="lg" className="rounded-xl shadow-lg shadow-destructive/20" onClick={() => setFlushConfirm(true)}>
            🔄 Ulangi Semua yang Gagal ({stats.failed})
          </Button>
        )}
        <Button type="button" variant="outline" size="lg" className="rounded-xl" onClick={() => { loadStats(); loadItems(); }}>
          🔄 Segarkan
        </Button>
      </div>

      {drainResult && (
        <div className="glass-card p-4 rounded-xl border border-primary/20">
          <p className="text-xs font-semibold text-primary mb-2">Hasil Eksekusi Manual:</p>
          <pre className="bg-background/50 rounded-lg p-3 text-xs overflow-x-auto text-muted-foreground">{drainResult}</pre>
        </div>
      )}
      
      {err && <div className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">{err}</div>}

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden mt-6">
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-background/20">
          <div className="text-sm font-medium">
            Menampilkan kategori: <Badge variant="outline" className="bg-background/50 backdrop-blur-sm px-3 py-1 text-sm capitalize">{STATUS_LABEL[filter] || filter}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">Maks. 50 data terbaru</div>
        </div>
        
        {loading ? (
          <div className="p-16 text-center text-muted-foreground animate-pulse-subtle">
            Memuat antrian...
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="text-5xl mb-4 opacity-30">✨</div>
            <h3 className="text-lg font-semibold mb-2">Kosong</h3>
            <p className="text-muted-foreground">Tidak ada pesan dalam status <strong>{STATUS_LABEL[filter]}</strong> saat ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-muted/50 border-b border-border/50">
                <tr>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">ID</th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Sumber → Tujuan</th>
                  <th className="text-center px-4 py-4 font-semibold text-muted-foreground">Percobaan</th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Status</th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Keterangan Error</th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Jadwal Kirim</th>
                  {filter === "failed" && (
                    <th className="text-right px-6 py-4 font-semibold text-muted-foreground">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-accent/20 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs opacity-70">#{item.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-muted/50 px-1 rounded">{item.source_chat_id ?? "?"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-mono text-xs bg-muted/50 px-1 rounded">{item.target_chat_id ?? "?"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 capitalize">{item.mode?.replace(/_/g, " ")}</div>
                    </td>
                    <td className="px-4 py-4 text-center font-medium">
                      {item.attempts > 0 ? <span className="text-amber-500">{item.attempts}x</span> : "0"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={STATUS_VARIANT[item.status] ?? "outline"} className="rounded-lg shadow-sm">
                        {STATUS_LABEL[item.status] || item.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs text-destructive max-w-[200px] truncate font-mono" title={item.last_error ?? ""}>
                      {item.last_error ?? <span className="text-muted-foreground opacity-50 italic">Tidak ada error</span>}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground font-medium">
                      {new Date(item.not_before).toLocaleString("id-ID", {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </td>
                    {filter === "failed" && (
                      <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="outline" className="rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setRetryConfirm(item.id)}>
                          🔄 Ulangi
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Flush Failed Confirm */}
      <AlertDialog open={flushConfirm} onOpenChange={setFlushConfirm}>
        <AlertDialogContent className="rounded-2xl glass-card border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl text-primary">🔄 Ulangi Semua Pesan Gagal?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Semua <strong>{stats.failed}</strong> pesan yang gagal akan dikembalikan ke status
              <strong> Menunggu</strong> dan sistem akan mencoba mengirimkannya kembali pada putaran berikutnya.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={flushFailed} className="rounded-xl">Ya, Ulangi Semua</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retry Single Confirm */}
      <AlertDialog open={retryConfirm !== null} onOpenChange={(v) => !v && setRetryConfirm(null)}>
        <AlertDialogContent className="rounded-2xl glass-card border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl text-primary">🔄 Ulangi Pesan #{retryConfirm}?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Pesan ini akan dikembalikan ke antrian untuk dicoba kirim ulang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => retryConfirm !== null && retryItem(retryConfirm)} className="rounded-xl">Ya, Ulangi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
