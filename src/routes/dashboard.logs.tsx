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
      <div>
        <h1 className="text-2xl font-semibold">Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Lihat log pesan yang diterima bot dan log audit perubahan konfigurasi.
        </p>
      </div>

      <Tabs defaultValue="message">
        <TabsList>
          <TabsTrigger value="message">Message Log</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* Message Log */}
        <TabsContent value="message" className="space-y-4 mt-4">
          <div className="flex gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="msg-search">Filter by Source Chat ID</Label>
              <Input
                id="msg-search"
                type="number"
                placeholder="-1001234567890"
                className="w-52"
                value={msgSearch}
                onChange={(e) => setMsgSearch(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" onClick={loadMsg}>Refresh</Button>
          </div>

          {msgErr && <p className="text-sm text-destructive">{msgErr}</p>}

          {loadingMsg ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : msgLogs.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              Belum ada log pesan. Pastikan webhook bot sudah dikonfigurasi dan bot menerima pesan dari source.
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Update ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source Chat</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Msg ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Diterima</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {msgLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{l.id}</td>
                      <td className="px-4 py-3 font-mono text-xs">{l.update_id ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{l.source_chat_id ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{l.source_msg_id ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(l.received_at).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Audit Log */}
        <TabsContent value="audit" className="space-y-4 mt-4">
          <div className="flex gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="audit-search">Cari (action / entity / actor)</Label>
              <Input
                id="audit-search"
                className="w-64"
                placeholder="addsource, pause..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" onClick={loadAudit}>Refresh</Button>
          </div>

          {auditErr && <p className="text-sm text-destructive">{auditErr}</p>}

          {loadingAudit ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : auditLogs.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              Belum ada audit log. Perubahan konfigurasi via command Telegram akan muncul di sini.
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entity</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Diff</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {auditLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{l.id}</td>
                      <td className="px-4 py-3 text-xs">{l.actor ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{l.action}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">{l.entity ? `${l.entity}:${l.entity_id}` : "—"}</td>
                      <td className="px-4 py-3 text-xs max-w-[200px] truncate font-mono" title={l.diff ? JSON.stringify(l.diff) : ""}>
                        {l.diff ? JSON.stringify(l.diff).slice(0, 60) + "…" : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
