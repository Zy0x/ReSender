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

const KIND_OPTIONS = ["group", "supergroup", "channel", "private", "bot"];

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sources</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola chat, grup, supergroup, channel, dan bot yang menjadi asal pesan Telegram.
            Tambahkan chat_id sumber agar bot mau meneruskan pesannya.
          </p>
        </div>
        <Button id="btn-add-source" onClick={openAdd}>+ Tambah Source</Button>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : sources.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
          Belum ada source. Klik <strong>+ Tambah Source</strong> untuk menambahkan.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Chat ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Judul</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipe</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sources.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{s.chat_id}</td>
                  <td className="px-4 py-3">{s.title ?? <span className="text-muted-foreground italic">—</span>}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{s.kind ?? "—"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.is_active ? "default" : "secondary"}>
                      {s.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(s)}>
                      {s.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDelId(s.id)}>Hapus</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Source" : "Tambah Source"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="src-chat-id">Chat ID <span className="text-destructive">*</span></Label>
              <Input
                id="src-chat-id"
                type="number"
                placeholder="-1001234567890"
                value={form.chat_id ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, chat_id: e.target.value ? Number(e.target.value) : undefined }))}
              />
              <p className="text-xs text-muted-foreground">Gunakan /whoami di bot untuk mendapatkan chat_id</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="src-title">Judul / Nama</Label>
              <Input
                id="src-title"
                placeholder="Contoh: Channel Berita"
                value={form.title ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="src-kind">Tipe Chat</Label>
              <Select value={form.kind ?? "channel"} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
                <SelectTrigger id="src-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="src-notes">Catatan</Label>
              <Textarea
                id="src-notes"
                placeholder="Opsional, catatan internal"
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="src-active"
                type="checkbox"
                checked={form.is_active ?? true}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="src-active">Aktifkan source</Label>
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="button" disabled={saving || !form.chat_id} onClick={save}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Source?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua rules yang terkait source ini juga akan ikut terhapus (cascade). Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
