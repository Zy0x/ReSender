import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/tg/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/dashboard/logs")({
  component: LogsPage,
});

type MessageLog = {
  id: number;
  update_id: number | null;
  source_chat_id: number | null;
  source_msg_id: number | null;
  received_at: string;
};

type AuditLog = {
  id: number;
  actor: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  diff: object | null;
  created_at: string;
};

function LogsPage() {
  const [msgLogs, setMsgLogs] = useState<MessageLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingMsg, setLoadingMsg] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [msgSearch, setMsgSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [msgErr, setMsgErr] = useState<string | null>(null);
  const [auditErr, setAuditErr] = useState<string | null>(null);

  const loadMsg = useCallback(async () => {
    setLoadingMsg(true);
    let q = supabase
      .from("tg_message_log")
      .select("id,update_id,source_chat_id,source_msg_id,received_at")
      .order("received_at", { ascending: false })
      .limit(100);
    if (msgSearch) {
      const chatId = Number(msgSearch);
      if (!isNaN(chatId) && chatId !== 0) {
        q = q.eq("source_chat_id", chatId);
      }
    }
    const { data, error } = await q;
    if (error) setMsgErr(error.message);
    else setMsgLogs(data as MessageLog[]);
    setLoadingMsg(false);
  }, [msgSearch]);

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    let q = supabase
      .from("tg_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (auditSearch) {
      q = q.or(`action.ilike.%${auditSearch}%,entity.ilike.%${auditSearch}%,actor.ilike.%${auditSearch}%`);
    }
    const { data, error } = await q;
    if (error) setAuditErr(error.message);
    else setAuditLogs(data as AuditLog[]);
    setLoadingAudit(false);
  }, [auditSearch]);

  useEffect(() => {
    loadMsg();
  }, [loadMsg]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-2xl">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Riwayat Aktivitas (Logs)</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Pantau riwayat pesan masuk yang diterima bot, serta catatan rekam jejak (audit) untuk semua perubahan konfigurasi yang pernah terjadi.
        </p>
      </div>

      <Tabs defaultValue="message" className="w-full">
        <TabsList className="bg-background/50 p-1 rounded-xl flex max-w-sm mb-6 glass-card">
          <TabsTrigger value="message" className="rounded-lg flex-1">Riwayat Pesan</TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg flex-1">Rekam Jejak (Audit)</TabsTrigger>
        </TabsList>

        {/* Message Log */}
        <TabsContent value="message" className="space-y-4">
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label htmlFor="msg-search">Cari ID Chat Sumber</Label>
                <Input
                  id="msg-search"
                  type="number"
                  placeholder="-1001234567890"
                  className="rounded-xl bg-background/50 focus-visible:ring-primary/50 w-full"
                  value={msgSearch}
                  onChange={(e) => setMsgSearch(e.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" className="rounded-xl shadow-md" onClick={loadMsg}>🔄 Segarkan Data</Button>
            </div>

            {msgErr && <div className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">{msgErr}</div>}

            <div className="rounded-xl border border-border/50 overflow-hidden bg-background/20 mt-4">
              {loadingMsg ? (
                <div className="p-16 text-center text-muted-foreground animate-pulse-subtle">Memuat riwayat pesan...</div>
              ) : msgLogs.length === 0 ? (
                <div className="p-16 text-center flex flex-col items-center justify-center">
                  <div className="text-5xl mb-4 opacity-30">📨</div>
                  <h3 className="text-lg font-semibold mb-2">Belum ada riwayat pesan</h3>
                  <p className="text-muted-foreground max-w-sm text-sm">Pastikan bot sudah berfungsi dan tergabung di dalam grup/channel sumber.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border/50">
                      <tr>
                        <th className="text-left px-6 py-4 font-semibold text-muted-foreground">ID Database</th>
                        <th className="text-left px-6 py-4 font-semibold text-muted-foreground">ID Update (Telegram)</th>
                        <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Sumber Chat</th>
                        <th className="text-left px-6 py-4 font-semibold text-muted-foreground">ID Pesan</th>
                        <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Waktu Diterima</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {msgLogs.map((l) => (
                        <tr key={l.id} className="hover:bg-accent/20 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs opacity-70">#{l.id}</td>
                          <td className="px-6 py-4 font-mono text-xs">{l.update_id ?? "—"}</td>
                          <td className="px-6 py-4 font-mono text-xs text-primary">{l.source_chat_id ?? "—"}</td>
                          <td className="px-6 py-4 font-mono text-xs">{l.source_msg_id ?? "—"}</td>
                          <td className="px-6 py-4 text-xs text-muted-foreground font-medium">
                            {new Date(l.received_at).toLocaleString("id-ID", {
                              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Audit Log */}
        <TabsContent value="audit" className="space-y-4">
          <div className="glass-card p-6 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-2 flex-1 max-w-sm">
                <Label htmlFor="audit-search">Cari Aktivitas (Tindakan / Pelaku / Entitas)</Label>
                <Input
                  id="audit-search"
                  className="rounded-xl bg-background/50 focus-visible:ring-primary/50 w-full"
                  placeholder="Ketik kata kunci pencarian..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" className="rounded-xl shadow-md" onClick={loadAudit}>🔄 Segarkan Data</Button>
            </div>

            {auditErr && <div className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">{auditErr}</div>}

            <div className="rounded-xl border border-border/50 overflow-hidden bg-background/20 mt-4">
              {loadingAudit ? (
                <div className="p-16 text-center text-muted-foreground animate-pulse-subtle">Memuat rekam jejak...</div>
              ) : auditLogs.length === 0 ? (
                <div className="p-16 text-center flex flex-col items-center justify-center">
                  <div className="text-5xl mb-4 opacity-30">🕵️</div>
                  <h3 className="text-lg font-semibold mb-2">Belum ada rekam jejak</h3>
                  <p className="text-muted-foreground max-w-sm text-sm">Semua perubahan pengaturan dari Web maupun Bot akan tercatat di sini.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead className="bg-muted/50 border-b border-border/50">
                      <tr>
                        <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Waktu</th>
                        <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Pelaku (Aktor)</th>
                        <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Tindakan</th>
                        <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Objek Terkait</th>
                        <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Detail (Perubahan)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {auditLogs.map((l) => (
                        <tr key={l.id} className="hover:bg-accent/20 transition-colors">
                          <td className="px-6 py-4 text-xs text-muted-foreground font-medium">
                            {new Date(l.created_at).toLocaleString("id-ID", {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4 font-medium text-xs">{l.actor ?? <span className="opacity-50">Sistem</span>}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className="bg-background/50 backdrop-blur-sm rounded-lg uppercase text-[10px]">
                              {l.action}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-xs text-primary">{l.entity ? `${l.entity}:${l.entity_id}` : "—"}</td>
                          <td className="px-6 py-4 text-xs font-mono max-w-[250px] truncate text-muted-foreground" title={l.diff ? JSON.stringify(l.diff, null, 2) : ""}>
                            {l.diff ? JSON.stringify(l.diff).slice(0, 50) + "..." : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
