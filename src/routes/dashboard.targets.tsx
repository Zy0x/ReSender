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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Targets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola chat, grup, supergroup, atau channel tujuan yang akan menerima pesan forward.
            Bot harus sudah menjadi anggota/admin di target.
          </p>
        </div>
        <Button id="btn-add-target" onClick={openAdd}>+ Tambah Target</Button>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : targets.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
          Belum ada target. Klik <strong>+ Tambah Target</strong> untuk menambahkan.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Chat ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Judul</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {targets.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{t.chat_id}</td>
                  <td className="px-4 py-3">{t.title ?? <span className="text-muted-foreground italic">—</span>}</td>
                  <td className="px-4 py-3">
                    <Badge variant={t.is_active ? "default" : "secondary"}>
                      {t.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(t)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(t)}>
                      {t.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDelId(t.id)}>Hapus</Button>
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
            <DialogTitle>{editId ? "Edit Target" : "Tambah Target"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="tgt-chat-id">Chat ID <span className="text-destructive">*</span></Label>
              <Input
                id="tgt-chat-id"
                type="number"
                placeholder="-1001234567890"
                value={form.chat_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, chat_id: e.target.value ? Number(e.target.value) : undefined }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Bot harus sudah di-invite ke grup/channel target. Gunakan /whoami untuk mendapatkan ID.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tgt-title">Judul / Nama</Label>
              <Input
                id="tgt-title"
                placeholder="Contoh: Grup Forward Utama"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="tgt-active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="tgt-active">Aktifkan target</Label>
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
            <AlertDialogTitle>Hapus Target?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua rules yang menggunakan target ini juga akan terhapus (cascade). Tindakan tidak bisa dibatalkan.
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
