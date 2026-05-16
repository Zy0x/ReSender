import { createFileRoute } from "@tanstack/react-router";
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
    { label: "Sources", value: stats.sources },
    { label: "Targets", value: stats.targets },
    { label: "Rules", value: stats.rules },
    { label: "Queue pending", value: stats.pending },
    { label: "Queue failed", value: stats.failed },
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="border border-border rounded-lg p-4 bg-card">
            <div className="text-xs uppercase text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-semibold mt-1">{c.value ?? "—"}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Lihat menu di kiri untuk mengelola Sources, Targets, Rules, Queue, dan Logs.
      </p>
    </div>
  );
}