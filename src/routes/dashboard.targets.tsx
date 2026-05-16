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

export const Route = createFileRoute("/dashboard/targets")({
  component: TargetsPage,
});

type Target = {
  id: string;
  chat_id: number;
  title: string | null;
  is_active: boolean;
  created_at: string;
};

function TargetsPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ chat_id: number | undefined; title: string; is_active: boolean }>({
    chat_id: undefined,
    title: "",
    is_active: true,
  });
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tg_targets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else setTargets(data as Target[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditId(null);
    setForm({ chat_id: undefined, title: "", is_active: true });
    setOpen(true);
  }

  function openEdit(t: Target) {
    setEditId(t.id);
    setForm({ chat_id: t.chat_id, title: t.title ?? "", is_active: t.is_active });
    setOpen(true);
  }

  async function save() {
    if (!form.chat_id) return;
    setSaving(true);
    setErr(null);
    const payload = {
      chat_id: Number(form.chat_id),
      title: form.title || null,
      is_active: form.is_active,
    };
    if (editId) {
      const { error } = await supabase.from("tg_targets").update(payload).eq("id", editId);
      if (error) { setErr(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("tg_targets").insert(payload);
      if (error) { setErr(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setOpen(false);
    load();
  }

  async function toggleActive(t: Target) {
    await supabase.from("tg_targets").update({ is_active: !t.is_active }).eq("id", t.id);
    load();
  }

  async function doDelete() {
    if (!delId) return;
    await supabase.from("tg_targets").delete().eq("id", delId);
    setDelId(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Tujuan Pesan</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Tentukan ke mana bot harus mengirim (forward) pesan. Bot wajib sudah ditambahkan sebagai admin/anggota di chat tujuan ini.
          </p>
        </div>
        <Button size="lg" className="rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform" onClick={openAdd}>
          ➕ Tambah Tujuan
        </Button>
      </div>

      {err && <div className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">{err}</div>}

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground animate-pulse-subtle">
            Memuat data...
          </div>
        ) : targets.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="text-5xl mb-4 opacity-50">🎯</div>
            <h3 className="text-lg font-semibold mb-2">Belum ada tujuan pesan</h3>
            <p className="text-muted-foreground mb-6 max-w-md">Tentukan ke mana pesan akan diteruskan.</p>
            <Button variant="outline" onClick={openAdd} className="rounded-xl">Tambah Sekarang</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border/50">
                <tr>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">ID Chat</th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Nama / Judul</th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-6 py-4 font-semibold text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {targets.map((t) => (
                  <tr key={t.id} className="hover:bg-accent/20 transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs opacity-70">{t.chat_id}</td>
                    <td className="px-6 py-4 font-medium">{t.title ?? <span className="text-muted-foreground italic">Tanpa Nama</span>}</td>
                    <td className="px-6 py-4">
                      <Badge variant={t.is_active ? "default" : "secondary"} className="rounded-lg shadow-sm">
                        {t.is_active ? "🟢 Aktif" : "⚪ Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="hover:bg-primary/10 rounded-lg" onClick={() => openEdit(t)}>✏️ Edit</Button>
                      <Button size="sm" variant="ghost" className="hover:bg-accent/10 rounded-lg" onClick={() => toggleActive(t)}>
                        {t.is_active ? "⏸️ Jeda" : "▶️ Lanjut"}
                      </Button>
                      <Button size="sm" variant="ghost" className="hover:bg-destructive/10 text-destructive rounded-lg" onClick={() => setDelId(t.id)}>🗑️ Hapus</Button>
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
            <DialogTitle className="text-2xl">{editId ? "Edit Tujuan" : "Tambah Tujuan Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="tgt-chat-id">ID Chat (Telegram) <span className="text-destructive">*</span></Label>
              <Input
                id="tgt-chat-id"
                type="number"
                className="rounded-xl bg-background/50 focus-visible:ring-primary/50"
                placeholder="-1001234567890"
                value={form.chat_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, chat_id: e.target.value ? Number(e.target.value) : undefined }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Bot wajib sudah menjadi anggota di chat ini. Gunakan perintah `/info` untuk melihat ID-nya.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tgt-title">Nama Singkat / Label</Label>
              <Input
                id="tgt-title"
                className="rounded-xl bg-background/50 focus-visible:ring-primary/50"
                placeholder="Contoh: Grup Arsip Utama"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-background/20">
              <input
                id="tgt-active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4 rounded accent-primary"
              />
              <Label htmlFor="tgt-active" className="font-medium cursor-pointer">Langsung aktifkan tujuan ini</Label>
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
            <AlertDialogTitle className="text-2xl text-destructive flex items-center gap-2">⚠️ Hapus Tujuan?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Apabila tujuan ini dihapus, <strong>semua aturan forward</strong> yang mengirim ke tujuan ini juga akan otomatis terhapus. Tindakan tidak bisa dibatalkan.
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
