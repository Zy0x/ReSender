import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/tg/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/dashboard/rules")({
  component: RulesPage,
});

type Source = { id: string; chat_id: number; title: string | null };
type Target = { id: string; chat_id: number; title: string | null };
type Rule = {
  id: string;
  source_id: string;
  target_id: string;
  mode: string;
  is_active: boolean;
  allow_text: boolean;
  allow_media: boolean;
  allow_links: boolean;
  allow_forwarded: boolean;
  keyword_include: string[];
  keyword_exclude: string[];
  min_len: number;
  max_len: number;
  header_template: string | null;
  footer_template: string | null;
  strip_mentions: boolean;
  strip_links: boolean;
  strip_usernames: boolean;
  strip_phone: boolean;
  cooldown_seconds: number;
  quota_per_minute: number;
  quota_per_hour: number;
  quota_per_day: number;
  on_excess: string;
  silent: boolean;
  protect_content: boolean;
  priority: number;
  source?: { chat_id: number; title: string | null };
  target?: { chat_id: number; title: string | null };
};

const MODE_OPTIONS = [
  { value: "native_forward", label: "Teruskan Asli (Dengan Nama Pengirim Asli)" },
  { value: "copy_hide_sender", label: "Salin Saja (Sembunyikan Nama Pengirim)" },
  { value: "notify_only", label: "Notifikasi Saja (Hanya Teks Ringkasan)" },
  { value: "anonymize", label: "Anonim (Salin & Ubah Kata-kata Tertentu)" },
  { value: "media_only", label: "Hanya Media (Abaikan Pesan Teks)" },
  { value: "text_only", label: "Hanya Teks (Abaikan Foto/Video)" },
];

const EXCESS_OPTIONS = [
  { value: "queue", label: "Masukkan ke Antrian (Akan dikirim nanti)" },
  { value: "drop", label: "Buang Pesan (Jangan dikirim)" },
];

function defaultForm(): Partial<Rule> {
  return {
    source_id: "",
    target_id: "",
    mode: "native_forward",
    is_active: true,
    allow_text: true,
    allow_media: true,
    allow_links: true,
    allow_forwarded: true,
    keyword_include: [],
    keyword_exclude: [],
    min_len: 0,
    max_len: 0,
    header_template: "",
    footer_template: "",
    strip_mentions: false,
    strip_links: false,
    strip_usernames: false,
    strip_phone: false,
    cooldown_seconds: 0,
    quota_per_minute: 0,
    quota_per_hour: 0,
    quota_per_day: 0,
    on_excess: "queue",
    silent: false,
    protect_content: false,
    priority: 100,
  };
}

function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Rule>>(defaultForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [kwInclude, setKwInclude] = useState("");
  const [kwExclude, setKwExclude] = useState("");

  async function load() {
    setLoading(true);
    const [rulesRes, srcRes, tgtRes] = await Promise.all([
      supabase
        .from("tg_rules")
        .select("*, source:tg_sources(chat_id,title), target:tg_targets(chat_id,title)")
        .order("priority", { ascending: false }),
      supabase.from("tg_sources").select("id,chat_id,title").eq("is_active", true),
      supabase.from("tg_targets").select("id,chat_id,title").eq("is_active", true),
    ]);
    if (rulesRes.error) setErr(rulesRes.error.message);
    else setRules(rulesRes.data as Rule[]);
    setSources((srcRes.data as Source[]) ?? []);
    setTargets((tgtRes.data as Target[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditId(null);
    setForm(defaultForm());
    setKwInclude("");
    setKwExclude("");
    setOpen(true);
  }

  function openEdit(r: Rule) {
    setEditId(r.id);
    setForm({ ...r });
    setKwInclude((r.keyword_include ?? []).join(", "));
    setKwExclude((r.keyword_exclude ?? []).join(", "));
    setOpen(true);
  }

  async function save() {
    if (!form.source_id || !form.target_id) return;
    setSaving(true);
    setErr(null);
    const payload = {
      ...form,
      keyword_include: kwInclude.split(",").map((s) => s.trim()).filter(Boolean),
      keyword_exclude: kwExclude.split(",").map((s) => s.trim()).filter(Boolean),
      header_template: form.header_template || null,
      footer_template: form.footer_template || null,
    };
    delete (payload as any).source;
    delete (payload as any).target;
    delete (payload as any).id;

    if (editId) {
      const { error } = await supabase.from("tg_rules").update(payload).eq("id", editId);
      if (error) { setErr(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("tg_rules").insert(payload);
      if (error) { setErr(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setOpen(false);
    load();
  }

  async function toggleActive(r: Rule) {
    await supabase.from("tg_rules").update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  }

  async function doDelete() {
    if (!delId) return;
    await supabase.from("tg_rules").delete().eq("id", delId);
    setDelId(null);
    load();
  }

  const bool = (key: keyof Rule, label: string) => (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-background/20 hover:bg-muted/30 transition-colors">
      <input
        id={`rule-${key}`}
        type="checkbox"
        className="h-4 w-4 rounded accent-primary"
        checked={Boolean(form[key])}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
      />
      <Label htmlFor={`rule-${key}`} className="font-medium cursor-pointer flex-1">{label}</Label>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Aturan Forward</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Tentukan dari mana pesan diambil, ke mana dikirim, serta atur filter dan transformasinya.
          </p>
        </div>
        <Button size="lg" className="rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform" onClick={openAdd} disabled={sources.length === 0 || targets.length === 0}>
          ➕ Buat Aturan Baru
        </Button>
      </div>

      {sources.length === 0 && targets.length === 0 && !loading && (
        <div className="p-4 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-medium">
          ⚠️ Mohon tambahkan minimal 1 Sumber dan 1 Tujuan yang aktif terlebih dahulu sebelum membuat aturan.
        </div>
      )}

      {err && <div className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">{err}</div>}

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground animate-pulse-subtle">
            Memuat data...
          </div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="text-5xl mb-4 opacity-50">⚙️</div>
            <h3 className="text-lg font-semibold mb-2">Belum ada aturan</h3>
            <p className="text-muted-foreground mb-6 max-w-md">Silakan buat aturan untuk mulai meneruskan pesan secara otomatis.</p>
            <Button variant="outline" onClick={openAdd} disabled={sources.length === 0 || targets.length === 0} className="rounded-xl">Buat Sekarang</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-muted/50 border-b border-border/50">
                <tr>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Dari (Sumber)</th>
                  <th className="text-center px-4 py-4 text-muted-foreground">→</th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Ke (Tujuan)</th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Mode</th>
                  <th className="text-left px-6 py-4 font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-6 py-4 font-semibold text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-accent/20 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-medium">{r.source?.title ?? <span className="italic text-muted-foreground">Tanpa Nama</span>}</div>
                      <div className="text-xs text-muted-foreground font-mono opacity-70 mt-1">{r.source?.chat_id}</div>
                    </td>
                    <td className="px-4 py-4 text-center text-muted-foreground">➡️</td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{r.target?.title ?? <span className="italic text-muted-foreground">Tanpa Nama</span>}</div>
                      <div className="text-xs text-muted-foreground font-mono opacity-70 mt-1">{r.target?.chat_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="bg-background/50 backdrop-blur-sm rounded-lg capitalize">
                        {r.mode.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={r.is_active ? "default" : "secondary"} className="rounded-lg shadow-sm">
                        {r.is_active ? "🟢 Aktif" : "⚪ Nonaktif"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="hover:bg-primary/10 rounded-lg" onClick={() => openEdit(r)}>✏️ Edit</Button>
                      <Button size="sm" variant="ghost" className="hover:bg-accent/10 rounded-lg" onClick={() => toggleActive(r)}>
                        {r.is_active ? "⏸️ Jeda" : "▶️ Lanjut"}
                      </Button>
                      <Button size="sm" variant="ghost" className="hover:bg-destructive/10 text-destructive rounded-lg" onClick={() => setDelId(r.id)}>🗑️ Hapus</Button>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl glass-card border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">{editId ? "Ubah Aturan" : "Buat Aturan Baru"}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basic" className="mt-4">
            <TabsList className="mb-6 bg-background/50 p-1 rounded-xl flex overflow-x-auto">
              <TabsTrigger value="basic" className="rounded-lg flex-1">Pengaturan Dasar</TabsTrigger>
              <TabsTrigger value="filter" className="rounded-lg flex-1">Filter Pesan</TabsTrigger>
              <TabsTrigger value="transform" className="rounded-lg flex-1">Ubah Teks</TabsTrigger>
              <TabsTrigger value="ratelimit" className="rounded-lg flex-1">Batasan Kecepatan</TabsTrigger>
              <TabsTrigger value="delivery" className="rounded-lg flex-1">Lainnya</TabsTrigger>
            </TabsList>

            {/* TAB: Dasar */}
            <TabsContent value="basic" className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="rule-source">Ambil Pesan Dari (Sumber) <span className="text-destructive">*</span></Label>
                <Select value={form.source_id} onValueChange={(v) => setForm((f) => ({ ...f, source_id: v }))}>
                  <SelectTrigger id="rule-source" className="rounded-xl bg-background/50">
                    <SelectValue placeholder="Pilih grup/channel asal..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {sources.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="rounded-lg">
                        {s.title ?? s.chat_id} ({s.chat_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-target">Kirim Pesan Ke (Tujuan) <span className="text-destructive">*</span></Label>
                <Select value={form.target_id} onValueChange={(v) => setForm((f) => ({ ...f, target_id: v }))}>
                  <SelectTrigger id="rule-target" className="rounded-xl bg-background/50">
                    <SelectValue placeholder="Pilih grup/channel tujuan..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {targets.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="rounded-lg">
                        {t.title ?? t.chat_id} ({t.chat_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-mode">Mode Pengiriman</Label>
                <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v }))}>
                  <SelectTrigger id="rule-mode" className="rounded-xl bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {MODE_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="rounded-lg">{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Gunakan "Salin Saja" jika Anda ingin meneruskan pesan dari bot lain melalui Private Chat.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-priority">Prioritas (Angka lebih besar = dijalankan duluan)</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  className="rounded-xl bg-background/50"
                  value={form.priority ?? 100}
                  onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                />
              </div>
              {bool("is_active", "Langsung aktifkan aturan ini")}
            </TabsContent>

            {/* TAB: Filter */}
            <TabsContent value="filter" className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {bool("allow_text", "Izinkan Pesan Teks")}
                {bool("allow_media", "Izinkan Foto/Video/Media")}
                {bool("allow_links", "Izinkan Tautan (Link)")}
                {bool("allow_forwarded", "Izinkan Pesan Terusan (Forward)")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-kw-include">Kata Kunci Wajib Ada (Pisahkan dengan koma)</Label>
                <Textarea
                  id="rule-kw-include"
                  rows={2}
                  className="rounded-xl bg-background/50"
                  placeholder="berita, darurat, promo"
                  value={kwInclude}
                  onChange={(e) => setKwInclude(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Pesan hanya akan dikirim jika mengandung salah satu kata di atas. Kosongkan jika tidak perlu.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-kw-exclude">Kata Kunci Terlarang (Pisahkan dengan koma)</Label>
                <Textarea
                  id="rule-kw-exclude"
                  rows={2}
                  className="rounded-xl bg-background/50"
                  placeholder="spam, iklan, diskon palsu"
                  value={kwExclude}
                  onChange={(e) => setKwExclude(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Pesan <strong>tidak</strong> akan dikirim jika mengandung kata di atas.</p>
              </div>
            </TabsContent>

            {/* TAB: Transformasi */}
            <TabsContent value="transform" className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="rule-header">Tambahkan Teks di Atas Pesan (Header)</Label>
                <Textarea
                  id="rule-header"
                  rows={2}
                  className="rounded-xl bg-background/50"
                  placeholder="📢 Dari: {source_title}"
                  value={form.header_template ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, header_template: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Gunakan variabel: {"{source_title}"}, {"{source_id}"}, {"{date}"}, {"{sender_initial}"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-footer">Tambahkan Teks di Bawah Pesan (Footer)</Label>
                <Textarea
                  id="rule-footer"
                  rows={2}
                  className="rounded-xl bg-background/50"
                  placeholder="— Pesan ini otomatis dikirim oleh ReSender"
                  value={form.footer_template ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, footer_template: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {bool("strip_mentions", "Hapus Mention (@username)")}
                {bool("strip_links", "Hapus Semua Link")}
                {bool("strip_usernames", "Hapus Username")}
                {bool("strip_phone", "Hapus Nomor Telepon")}
              </div>
            </TabsContent>

            {/* TAB: Rate Limit */}
            <TabsContent value="ratelimit" className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rule-cooldown">Jeda Antar Pesan (detik)</Label>
                  <Input
                    id="rule-cooldown"
                    type="number"
                    min={0}
                    className="rounded-xl bg-background/50"
                    placeholder="Contoh: 10"
                    value={form.cooldown_seconds ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, cooldown_seconds: Number(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">0 = Tidak ada jeda</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-qpm">Maksimal Pesan Per Menit</Label>
                  <Input
                    id="rule-qpm"
                    type="number"
                    min={0}
                    className="rounded-xl bg-background/50"
                    value={form.quota_per_minute ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, quota_per_minute: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rule-qph">Maksimal Pesan Per Jam</Label>
                  <Input
                    id="rule-qph"
                    type="number"
                    min={0}
                    className="rounded-xl bg-background/50"
                    value={form.quota_per_hour ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, quota_per_hour: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="space-y-2 pt-4">
                <Label htmlFor="rule-excess">Jika Terlalu Banyak Pesan (Limit Tercapai):</Label>
                <Select value={form.on_excess ?? "queue"} onValueChange={(v) => setForm((f) => ({ ...f, on_excess: v }))}>
                  <SelectTrigger id="rule-excess" className="rounded-xl bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {EXCESS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="rounded-lg">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* TAB: Pengiriman */}
            <TabsContent value="delivery" className="space-y-5">
              <div className="space-y-4">
                {bool("silent", "Kirim Tanpa Suara (Silent Notification)")}
                {bool("protect_content", "Cegah Penerima Meneruskan Pesan (Protect Content)")}
              </div>
            </TabsContent>
          </Tabs>

          {err && <p className="text-sm text-destructive font-medium mt-4">{err}</p>}

          <DialogFooter className="mt-8 gap-2 border-t border-border/50 pt-4">
            <Button type="button" variant="ghost" className="rounded-xl hover:bg-muted/50" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="button" className="rounded-xl" disabled={saving || !form.source_id || !form.target_id} onClick={save}>
              {saving ? "⏳ Menyimpan..." : "✅ Simpan Aturan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent className="rounded-2xl glass-card border-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl text-destructive flex items-center gap-2">⚠️ Hapus Aturan?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Aturan ini akan dihapus permanen. Antrian pesan yang belum terkirim dari aturan ini juga akan dihapus.
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
