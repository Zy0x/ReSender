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

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

type TgAdmin = {
  telegram_user_id: number;
  display_name: string | null;
  added_at: string;
};

type AppUser = {
  user_id: string;
  role: string;
  added_at: string;
};

function SettingsPage() {
  const [tgAdmins, setTgAdmins] = useState<TgAdmin[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [healthResult, setHealthResult] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Telegram admin CRUD
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [newAdminId, setNewAdminId] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [delAdminId, setDelAdminId] = useState<number | null>(null);

  async function loadAdmins() {
    setLoadingAdmins(true);
    const [adminRes, usersRes] = await Promise.all([
      supabase.from("tg_admins").select("*").order("added_at", { ascending: false }),
      supabase.from("app_users").select("*").order("added_at", { ascending: false }),
    ]);
    setTgAdmins((adminRes.data as TgAdmin[]) ?? []);
    setAppUsers((usersRes.data as AppUser[]) ?? []);
    setLoadingAdmins(false);
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  async function addTgAdmin() {
    if (!newAdminId) return;
    setSavingAdmin(true);
    const { error } = await supabase.from("tg_admins").insert({
      telegram_user_id: Number(newAdminId),
      display_name: newAdminName || null,
    });
    if (error) setErr(error.message);
    else {
      setAddAdminOpen(false);
      setNewAdminId("");
      setNewAdminName("");
      loadAdmins();
    }
    setSavingAdmin(false);
  }

  async function deleteTgAdmin() {
    if (!delAdminId) return;
    await supabase.from("tg_admins").delete().eq("telegram_user_id", delAdminId);
    setDelAdminId(null);
    loadAdmins();
  }

  async function checkHealth() {
    setHealthResult(null);
    try {
      const res = await fetch("/api/public/tg/healthz");
      const json = await res.json();
      setHealthResult(JSON.stringify(json, null, 2));
    } catch (e: any) {
      setHealthResult(`Error: ${e.message}`);
    }
  }

  const setWebhookCommand = `npm run set-webhook -- --target=workers --url=${webhookUrl || "https://your-app.example.com/api/public/tg/webhook"}`;
  const deleteWebhookCommand = "npm run delete-webhook -- --target=workers";

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 rounded-2xl">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Pengaturan Sistem</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Kelola administrator bot Telegram, konfigurasi jaringan webhook, dan pantau status kesehatan aplikasi ReSender.
        </p>
      </div>

      {err && <div className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">{err}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Telegram Webhook Setup */}
        <section className="glass-card p-6 rounded-2xl space-y-5 lg:row-span-2">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">🔌 Koneksi Webhook Telegram</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Atur sambungan bot dari terminal/server agar token bot tidak pernah diketik di browser.
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
            Jangan masukkan <strong>TELEGRAM_BOT_TOKEN</strong> di halaman web. Token hanya boleh berada di environment server
            dan dipakai oleh script operasional.
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wh-url">URL Aplikasi ReSender</Label>
              <Input
                id="wh-url"
                type="url"
                className="rounded-xl bg-background/50 focus-visible:ring-primary/50"
                placeholder="https://your-app.example.com/api/public/tg/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-secret">Kunci Rahasia (TELEGRAM_WEBHOOK_SECRET)</Label>
              <Input
                id="wh-secret"
                type="password"
                className="rounded-xl bg-background/50 focus-visible:ring-primary/50"
                placeholder="Opsional: isi untuk checklist lokal, jangan dibagikan"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/50 bg-background/40 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Set webhook dari terminal</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs text-foreground">{setWebhookCommand}</pre>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hapus webhook jika perlu reset</p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs text-foreground">{deleteWebhookCommand}</pre>
            </div>
          </div>

          <div className="border-t border-border/50 pt-4 mt-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">📖 Panduan Singkat</h3>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside bg-muted/20 p-4 rounded-xl">
              <li>Deploy aplikasi ini menggunakan HTTPS.</li>
              <li>Pastikan <strong>TELEGRAM_BOT_TOKEN</strong> dan <strong>TELEGRAM_WEBHOOK_SECRET</strong> sudah ada di environment server.</li>
              <li>Jalankan command set webhook dari terminal proyek.</li>
              <li>Gunakan tombol health check di kanan untuk memastikan runtime dan database sehat.</li>
            </ol>
          </div>
        </section>

        {/* Telegram Admins */}
        <section className="glass-card p-6 rounded-2xl space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">🛡️ Admin Bot Telegram</h2>
              <p className="text-sm text-muted-foreground mt-1">Daftar ID Telegram yang diizinkan memberi perintah ke bot.</p>
            </div>
            <Button id="btn-add-tg-admin" className="rounded-xl shadow-lg shadow-primary/20" type="button" onClick={() => setAddAdminOpen(true)}>
              ➕ Tambah Admin
            </Button>
          </div>

          <div className="rounded-xl border border-border/50 overflow-hidden bg-background/20">
            {loadingAdmins ? (
              <div className="p-8 text-center text-muted-foreground animate-pulse-subtle">Memuat admin...</div>
            ) : tgAdmins.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Belum ada admin Telegram terdaftar.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">ID Telegram</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Nama</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {tgAdmins.map((a) => (
                      <tr key={a.telegram_user_id} className="hover:bg-accent/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">{a.telegram_user_id}</td>
                        <td className="px-4 py-3 font-medium">{a.display_name ?? <span className="italic text-muted-foreground">Tanpa Nama</span>}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => setDelAdminId(a.telegram_user_id)}>
                            Hapus
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Health Check */}
        <section className="glass-card p-6 rounded-2xl space-y-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">🩺 Status Kesehatan Sistem</h2>
            <p className="text-sm text-muted-foreground mt-1">Periksa apakah database dan aplikasi berjalan normal.</p>
          </div>
          <Button id="btn-healthcheck" type="button" variant="outline" className="rounded-xl" onClick={checkHealth}>
            🔍 Periksa Sekarang
          </Button>
          {healthResult && (
            <div className="bg-background/50 p-4 rounded-xl border border-primary/20 overflow-x-auto mt-4">
              <pre className="text-xs text-muted-foreground">{healthResult}</pre>
            </div>
          )}
        </section>

      </div>

      {/* Panduan Perintah Bot */}
      <section className="glass-card rounded-2xl p-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-2">🤖 Daftar Perintah Bot Telegram</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Kirimkan perintah ini di chat langsung dengan bot Anda (hanya berfungsi bagi Admin terdaftar).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            ["/sumber", "Lihat daftar sumber pesan"],
            ["/tujuan", "Lihat daftar tujuan pesan"],
            ["/aturan", "Lihat daftar aturan aktif"],
            ["/antrian", "Lihat status antrian saat ini"],
            ["/jeda", "Hentikan sementara (pause) suatu aturan"],
            ["/lanjut", "Lanjutkan kembali (resume) aturan"],
            ["/bantuan", "Tampilkan panduan penggunaan"],
            ["/info", "Lihat ID chat Anda / grup ini"],
          ].map(([cmd, desc]) => (
            <div key={cmd} className="flex flex-col p-3 rounded-xl bg-background/50 border border-border/50 hover:bg-primary/5 transition-colors">
              <code className="font-mono text-primary font-bold mb-1">{cmd}</code>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Add Admin Dialog */}
      <Dialog open={addAdminOpen} onOpenChange={setAddAdminOpen}>
        <DialogContent className="max-w-md rounded-2xl glass-card border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Tambah Admin Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-admin-id">ID Telegram Pengguna <span className="text-destructive">*</span></Label>
              <Input
                id="new-admin-id"
                type="number"
                className="rounded-xl bg-background/50 focus-visible:ring-primary/50"
                placeholder="123456789"
                value={newAdminId}
                onChange={(e) => setNewAdminId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Ketik <code>/info</code> di bot untuk mendapatkan ID Anda.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-admin-name">Nama Panggilan (Opsional)</Label>
              <Input
                id="new-admin-name"
                className="rounded-xl bg-background/50 focus-visible:ring-primary/50"
                placeholder="Misal: Bos Besar"
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setAddAdminOpen(false)}>Batal</Button>
            <Button type="button" className="rounded-xl" disabled={!newAdminId || savingAdmin} onClick={addTgAdmin}>
              {savingAdmin ? "⏳ Menyimpan..." : "✅ Tambahkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Admin Confirm */}
      <AlertDialog open={delAdminId !== null} onOpenChange={(v) => !v && setDelAdminId(null)}>
        <AlertDialogContent className="rounded-2xl glass-card border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl text-destructive flex items-center gap-2">⚠️ Hapus Admin?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Pengguna dengan ID <strong>{delAdminId}</strong> tidak akan bisa lagi menggunakan bot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTgAdmin} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
              Ya, Cabut Akses
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
