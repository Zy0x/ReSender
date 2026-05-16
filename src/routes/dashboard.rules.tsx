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
  { value: "native_forward", label: "native_forward — teruskan asli (with attribution)" },
  { value: "copy_hide_sender", label: "copy_hide_sender — salin tanpa atribusi pengirim" },
  { value: "notify_only", label: "notify_only — hanya kirim notifikasi ringkasan" },
  { value: "anonymize", label: "anonymize — salin dengan transformasi" },
  { value: "media_only", label: "media_only — hanya media, skip teks saja" },
  { value: "text_only", label: "text_only — hanya teks, skip media" },
];

const EXCESS_OPTIONS = [
  { value: "queue", label: "queue — antrian & retry" },
  { value: "drop", label: "drop — buang jika rate limit tercapai" },
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
      keyword_include: kwInclude
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      keyword_exclude: kwExclude
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
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

  const bool = (key: keyof Rule) => (
    <div className="flex items-center gap-2">
      <input
        id={`rule-${key}`}
        type="checkbox"
        className="h-4 w-4"
        checked={Boolean(form[key])}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
      />
      <Label htmlFor={`rule-${key}`}>{key.replace(/_/g, " ")}</Label>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mapping source → target dengan mode forward, filter, transformasi, rate limit, dan prioritas.
          </p>
        </div>
        <Button id="btn-add-rule" onClick={openAdd} disabled={sources.length === 0 || targets.length === 0}>
          + Tambah Rule
        </Button>
      </div>

      {sources.length === 0 && targets.length === 0 && !loading && (
        <div className="border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg p-4 text-sm">
          ⚠️ Tambahkan minimal 1 Source dan 1 Target aktif sebelum membuat Rule.
        </div>
      )}

      {err && <p className="text-sm text-destructive">{err}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : rules.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
          Belum ada rule. Tambahkan Source & Target terlebih dahulu, lalu klik <strong>+ Tambah Rule</strong>.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Target</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mode</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Prioritas</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.source?.title ?? "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.source?.chat_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.target?.title ?? "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.target?.chat_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{r.mode}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">{r.priority}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.is_active ? "default" : "secondary"}>
                      {r.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(r)}>
                      {r.is_active ? "Pause" : "Resume"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDelId(r.id)}>Hapus</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Rule" : "Tambah Rule"}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basic">
            <TabsList className="mb-4">
              <TabsTrigger value="basic">Dasar</TabsTrigger>
              <TabsTrigger value="filter">Filter</TabsTrigger>
              <TabsTrigger value="transform">Transformasi</TabsTrigger>
              <TabsTrigger value="ratelimit">Rate Limit</TabsTrigger>
              <TabsTrigger value="delivery">Pengiriman</TabsTrigger>
            </TabsList>

            {/* TAB: Dasar */}
            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="rule-source">Source <span className="text-destructive">*</span></Label>
                <Select value={form.source_id} onValueChange={(v) => setForm((f) => ({ ...f, source_id: v }))}>
                  <SelectTrigger id="rule-source">
                    <SelectValue placeholder="Pilih source..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title ?? s.chat_id} ({s.chat_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-target">Target <span className="text-destructive">*</span></Label>
                <Select value={form.target_id} onValueChange={(v) => setForm((f) => ({ ...f, target_id: v }))}>
                  <SelectTrigger id="rule-target">
                    <SelectValue placeholder="Pilih target..." />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title ?? t.chat_id} ({t.chat_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-mode">Mode Forward</Label>
                <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v }))}>
                  <SelectTrigger id="rule-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODE_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-priority">Prioritas (lebih tinggi = diproses lebih dulu)</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  value={form.priority ?? 100}
                  onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                />
              </div>
              {bool("is_active")}
            </TabsContent>

            {/* TAB: Filter */}
            <TabsContent value="filter" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {bool("allow_text")}
                {bool("allow_media")}
                {bool("allow_links")}
                {bool("allow_forwarded")}
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-kw-include">Keyword Include (pisah koma)</Label>
                <Textarea
                  id="rule-kw-include"
                  rows={2}
                  placeholder="berita, breaking, update"
                  value={kwInclude}
                  onChange={(e) => setKwInclude(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Pesan hanya di-forward jika mengandung salah satu kata ini.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-kw-exclude">Keyword Exclude (pisah koma)</Label>
                <Textarea
                  id="rule-kw-exclude"
                  rows={2}
                  placeholder="spam, iklan, promosi"
                  value={kwExclude}
                  onChange={(e) => setKwExclude(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Pesan tidak di-forward jika mengandung salah satu kata ini.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rule-min-len">Min panjang teks (0 = nonaktif)</Label>
                  <Input
                    id="rule-min-len"
                    type="number"
                    min={0}
                    value={form.min_len ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, min_len: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rule-max-len">Max panjang teks (0 = nonaktif)</Label>
                  <Input
                    id="rule-max-len"
                    type="number"
                    min={0}
                    value={form.max_len ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, max_len: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </TabsContent>

            {/* TAB: Transformasi */}
            <TabsContent value="transform" className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="rule-header">Header Template</Label>
                <Textarea
                  id="rule-header"
                  rows={2}
                  placeholder="📢 Dari {source_title} — {date}"
                  value={form.header_template ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, header_template: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Variabel: {"{source_title}"}, {"{source_id}"}, {"{date}"}, {"{sender_initial}"}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-footer">Footer Template</Label>
                <Textarea
                  id="rule-footer"
                  rows={2}
                  placeholder="— Diteruskan otomatis"
                  value={form.footer_template ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, footer_template: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {bool("strip_mentions")}
                {bool("strip_links")}
                {bool("strip_usernames")}
                {bool("strip_phone")}
              </div>
            </TabsContent>

            {/* TAB: Rate Limit */}
            <TabsContent value="ratelimit" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="rule-cooldown">Cooldown (detik, 0 = nonaktif)</Label>
                  <Input
                    id="rule-cooldown"
                    type="number"
                    min={0}
                    value={form.cooldown_seconds ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, cooldown_seconds: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rule-qpm">Quota per menit (0 = nonaktif)</Label>
                  <Input
                    id="rule-qpm"
                    type="number"
                    min={0}
                    value={form.quota_per_minute ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, quota_per_minute: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rule-qph">Quota per jam (0 = nonaktif)</Label>
                  <Input
                    id="rule-qph"
                    type="number"
                    min={0}
                    value={form.quota_per_hour ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, quota_per_hour: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rule-qpd">Quota per hari (0 = nonaktif)</Label>
                  <Input
                    id="rule-qpd"
                    type="number"
                    min={0}
                    value={form.quota_per_day ?? 0}
                    onChange={(e) => setForm((f) => ({ ...f, quota_per_day: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rule-excess">Jika rate limit tercapai</Label>
                <Select value={form.on_excess ?? "queue"} onValueChange={(v) => setForm((f) => ({ ...f, on_excess: v }))}>
                  <SelectTrigger id="rule-excess">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXCESS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* TAB: Pengiriman */}
            <TabsContent value="delivery" className="space-y-4">
              {bool("silent")}
              {bool("protect_content")}
              <p className="text-xs text-muted-foreground">
                <strong>silent</strong>: pesan dikirim tanpa notifikasi suara.<br />
                <strong>protect_content</strong>: mencegah penerima meneruskan/menyimpan pesan.
              </p>
            </TabsContent>
          </Tabs>

          {err && <p className="text-sm text-destructive mt-2">{err}</p>}

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="button" disabled={saving || !form.source_id || !form.target_id} onClick={save}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Rule ini akan dihapus permanen. Queue pesan yang masih pending untuk rule ini juga akan ikut terhapus.
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
