import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/tg/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/dashboard/sources")({
  component: SourcesPage,
});

type Source = {
  id: string;
  chat_id: number;
  title: string | null;
  kind: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

const KIND_OPTIONS = [
  { value: "group", label: "Grup" },
  { value: "supergroup", label: "Supergrup" },
  { value: "channel", label: "Channel" },
  { value: "private", label: "Private Chat" },
  { value: "bot", label: "Bot" }
];

function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Source>>({
    chat_id: undefined,
    title: "",
    kind: "channel",
    notes: "",
    is_active: true,
  });
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tg_sources")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else setSources(data as Source[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditId(null);
    setForm({ chat_id: undefined, title: "", kind: "channel", notes: "", is_active: true });
    setOpen(true);
  }

  function openEdit(s: Source) {
    setEditId(s.id);
    setForm({ chat_id: s.chat_id, title: s.title ?? "", kind: s.kind ?? "channel", notes: s.notes ?? "", is_active: s.is_active });
    setOpen(true);
  }

  async function save() {
    if (!form.chat_id) return;
    setSaving(true);
    setErr(null);
    const payload = {
      chat_id: Number(form.chat_id),
      title: form.title || null,
      kind: form.kind || null,
      notes: form.notes || null,
      is_active: form.is_active ?? true,
    };
    if (editId) {
      const { error } = await supabase.from("tg_sources").update(payload).eq("id", editId);
      if (error) { setErr(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("tg_sources").insert(payload);
      if (error) { setErr(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setOpen(false);
    load();
  }

  async function toggleActive(s: Source) {
    await supabase.from("tg_sources").update({ is_active: !s.is_active }).eq("id", s.id);
    load();
  }

  async function doDelete() {
    if (!delId) return;
    await supabase.from("tg_sources").delete().eq("id", delId);
    setDelId(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Sumber Pesan</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Tentukan dari mana bot harus "membaca" pesan. Ini bisa berupa grup, channel, atau private chat.
          </p>
        </div>
        <Button size="lg" className="rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform" onClick={openAdd}>
          ➕ Tambah Sumber
        </Button>
      </div>

      {err && <div className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">{err}</div>}

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground animate-pulse-subtle">
            Memuat data...
          </div>
        ) : sources.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="text-5xl mb-4 opacity-50">📥</div>
            <h3 className="text-lg font-semibold mb-2">Belum ada sumber pesan</h3>
            <p className="text-muted-foreground mb-6 max-w-md">Tambahkan tempat bot membaca pesan terlebih dahulu.</p>
            <Button variant="outline" onClick={openAdd} className="rounded-xl">Tambah Sekarang</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border/50">
                <tr>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">ID Chat</th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Nama / Judul</th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Tipe</th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-6 py-4 font-semibold text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sources.map((s) => (
                  <tr key={s.id} className="hover:bg-accent/20 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs opacity-70">{s.chat_id}</td>
                    <td className="px-6 py-4 font-medium">{s.title ?? <span className="text-muted-foreground italic">Tanpa Nama</span>}</td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="bg-background/50 backdrop-blur-sm rounded-lg capitalize">
                        {KIND_OPTIONS.find(k => k.value === s.kind)?.label ?? s.kind ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={s.is_active ? "default" : "secondary"} className="rounded-lg shadow-sm">
                        {s.is_active ? "🟢 Aktif" : "⚪ Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="hover:bg-primary/10 rounded-lg" onClick={() => openEdit(s)}>✏️ Edit</Button>
                      <Button size="sm" variant="ghost" className="hover:bg-accent/10 rounded-lg" onClick={() => toggleActive(s)}>
                        {s.is_active ? "⏸️ Jeda" : "▶️ Lanjut"}
                      </Button>
                      <Button size="sm" variant="ghost" className="hover:bg-destructive/10 text-destructive rounded-lg" onClick={() => setDelId(s.id)}>🗑️ Hapus</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-2xl glass-card border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">{editId ? "Edit Sumber" : "Tambah Sumber Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="src-chat-id">ID Chat (Telegram) <span className="text-destructive">*</span></Label>
              <Input
                id="src-chat-id"
                type="number"
                className="rounded-xl bg-background/50 focus-visible:ring-primary/50"
                placeholder="-1001234567890"
                value={form.chat_id ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, chat_id: e.target.value ? Number(e.target.value) : undefined }))}
              />
              <p className="text-xs text-muted-foreground">Gunakan perintah `/info` di chat bersama bot untuk mengetahui ID-nya.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="src-title">Nama Singkat / Label</Label>
              <Input
                id="src-title"
                className="rounded-xl bg-background/50 focus-visible:ring-primary/50"
                placeholder="Contoh: Channel Berita Utama"
                value={form.title ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="src-kind">Tipe Chat</Label>
              <Select value={form.kind ?? "channel"} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
                <SelectTrigger id="src-kind" className="rounded-xl bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {KIND_OPTIONS.map((k) => (
                    <SelectItem key={k.value} value={k.value} className="rounded-lg">{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="src-notes">Catatan Tambahan</Label>
              <Textarea
                id="src-notes"
                className="rounded-xl bg-background/50 focus-visible:ring-primary/50"
                placeholder="Hanya untuk pengingat Anda sendiri..."
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-background/20">
              <input
                id="src-active"
                type="checkbox"
                checked={form.is_active ?? true}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 rounded accent-primary"
              />
              <Label htmlFor="src-active" className="font-medium cursor-pointer">Langsung aktifkan sumber ini</Label>
            </div>
            {err && <p className="text-sm text-destructive font-medium">{err}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" className="rounded-xl hover:bg-muted/50" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="button" className="rounded-xl" disabled={saving || !form.chat_id} onClick={save}>
              {saving ? "⏳ Menyimpan..." : "✅ Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent className="rounded-2xl glass-card border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl text-destructive flex items-center gap-2">⚠️ Hapus Sumber?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Apabila sumber ini dihapus, <strong>semua aturan forward</strong> yang terhubung dengannya juga akan terhapus. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Ya, Hapus Permanen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
