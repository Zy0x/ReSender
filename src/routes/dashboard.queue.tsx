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
    // Reset all failed to pending
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
    { label: "Pending", key: "pending", color: "text-blue-500" },
    { label: "Processing", key: "processing", color: "text-yellow-500" },
    { label: "Sent", key: "sent", color: "text-green-500" },
    { label: "Failed", key: "failed", color: "text-red-500" },
    { label: "Dropped", key: "dropped", color: "text-gray-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pantau dan kelola antrian forward pesan, retry manual, dan drain queue.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {statCards.map((c) => (
          <button
            key={c.key}
            id={`queue-filter-${c.key}`}
            onClick={() => setFilter(c.key)}
            className={`border rounded-lg p-4 text-left transition-colors hover:bg-muted/50 ${filter === c.key ? "border-primary bg-muted/50" : "border-border bg-card"}`}
          >
            <div className="text-xs uppercase text-muted-foreground">{c.label}</div>
            <div className={`text-2xl font-semibold mt-1 ${c.color}`}>
              {stats[c.key as keyof Stats]}
            </div>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label htmlFor="cron-secret-input">CRON_SECRET (untuk drain manual)</Label>
          <Input
            id="cron-secret-input"
            type="password"
            className="w-64"
            placeholder="cron secret dari .env"
            value={cronSecret}
            onChange={(e) => setCronSecret(e.target.value)}
          />
        </div>
        <Button
          id="btn-drain-queue"
          type="button"
          disabled={!cronSecret || draining}
          onClick={drainQueue}
        >
          {draining ? "Memproses..." : "Drain Queue Sekarang"}
        </Button>
        {stats.failed > 0 && (
          <Button type="button" variant="outline" onClick={() => setFlushConfirm(true)}>
            Retry Semua Failed ({stats.failed})
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => { loadStats(); loadItems(); }}>
          Refresh
        </Button>
      </div>

      {drainResult && (
        <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{drainResult}</pre>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}

      {/* Table */}
      <div className="space-y-2">
        <div className="text-sm font-medium">
          Menampilkan: <Badge variant="outline">{filter}</Badge> (maks 50)
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : items.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
            Tidak ada item dengan status <strong>{filter}</strong>.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source Chat</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Target Chat</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mode</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Attempts</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Error</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Not Before</th>
                  {filter === "failed" && (
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{item.id}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.source_chat_id ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.target_chat_id ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{item.mode ?? "—"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">{item.attempts}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[item.status] ?? "outline"}>{item.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-destructive max-w-[200px] truncate" title={item.last_error ?? ""}>
                      {item.last_error ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(item.not_before).toLocaleString("id-ID")}
                    </td>
                    {filter === "failed" && (
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" onClick={() => setRetryConfirm(item.id)}>
                          Retry
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry Semua Failed?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua {stats.failed} item dengan status <strong>failed</strong> akan dikembalikan ke status
              <strong> pending</strong> dengan attempts direset ke 0.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={flushFailed}>Retry Semua</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retry Single Confirm */}
      <AlertDialog open={retryConfirm !== null} onOpenChange={(v) => !v && setRetryConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry item #{retryConfirm}?</AlertDialogTitle>
            <AlertDialogDescription>
              Item ini akan dikembalikan ke status pending dan attempts direset ke 0.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => retryConfirm !== null && retryItem(retryConfirm)}>Retry</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
