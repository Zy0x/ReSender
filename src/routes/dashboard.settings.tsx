import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/tg/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookResult, setWebhookResult] = useState<string | null>(null);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [botToken, setBotToken] = useState("");
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

  async function setWebhook() {
    if (!webhookUrl || !botToken) return;
    setWebhookLoading(true);
    setWebhookResult(null);
    try {
      const params = new URLSearchParams({ url: webhookUrl });
      if (webhookSecret) params.set("secret_token", webhookSecret);
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook?${params.toString()}`,
        { method: "POST" },
      );
      const json = await res.json();
      setWebhookResult(JSON.stringify(json, null, 2));
    } catch (e: any) {
      setWebhookResult(`Error: ${e.message}`);
    }
    setWebhookLoading(false);
  }

  async function getWebhookInfo() {
    if (!botToken) return;
    setWebhookLoading(true);
    setWebhookResult(null);
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const json = await res.json();
      setWebhookResult(JSON.stringify(json, null, 2));
    } catch (e: any) {
      setWebhookResult(`Error: ${e.message}`);
    }
    setWebhookLoading(false);
  }

  async function deleteWebhook() {
    if (!botToken) return;
    setWebhookLoading(true);
    setWebhookResult(null);
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, { method: "POST" });
      const json = await res.json();
      setWebhookResult(JSON.stringify(json, null, 2));
    } catch (e: any) {
      setWebhookResult(`Error: ${e.message}`);
    }
    setWebhookLoading(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola admin Telegram, konfigurasi webhook, dan cek status runtime.
        </p>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {/* Health Check */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Health Check</h2>
        <Button id="btn-healthcheck" type="button" variant="outline" onClick={checkHealth}>
          Cek Status Runtime
        </Button>
        {healthResult && (
          <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{healthResult}</pre>
        )}
      </section>

      {/* Telegram Webhook Manager */}
      <section className="space-y-4 border border-border rounded-lg p-5">
        <h2 className="text-lg font-medium">Telegram Webhook Manager</h2>
        <p className="text-sm text-muted-foreground">
          Atur webhook bot langsung dari dashboard. Bot token tidak disimpan, hanya dipakai sementara di sesi ini.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="wh-bot-token">Bot Token (tidak disimpan)</Label>
            <Input
              id="wh-bot-token"
              type="password"
              placeholder="123456:ABCDEFxxxx"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wh-url">Webhook URL</Label>
            <Input
              id="wh-url"
              type="url"
              placeholder="https://your-app.example.com/api/public/tg/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wh-secret">Webhook Secret Token (TELEGRAM_WEBHOOK_SECRET)</Label>
            <Input
              id="wh-secret"
              type="password"
              placeholder="secret random string"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            id="btn-set-webhook"
            type="button"
            disabled={!botToken || !webhookUrl || webhookLoading}
            onClick={setWebhook}
          >
            Set Webhook
          </Button>
          <Button
            id="btn-get-webhook-info"
            type="button"
            variant="outline"
            disabled={!botToken || webhookLoading}
            onClick={getWebhookInfo}
          >
            Info Webhook
          </Button>
          <Button
            id="btn-delete-webhook"
            type="button"
            variant="destructive"
            disabled={!botToken || webhookLoading}
            onClick={deleteWebhook}
          >
            Hapus Webhook
          </Button>
        </div>
        {webhookResult && (
          <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{webhookResult}</pre>
        )}
        <div className="border-t border-border pt-3">
          <h3 className="text-sm font-medium mb-2">Panduan Setup Webhook</h3>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Deploy aplikasi ini ke Netlify, Cloudflare Workers, atau server publik dengan HTTPS.</li>
            <li>Set semua env var dari <code>.env.example</code> di dashboard hosting (bukan .env).</li>
            <li>Isi Bot Token (dari @BotFather) dan Webhook URL (URL deploy + /api/public/tg/webhook).</li>
            <li>Isi Webhook Secret sesuai nilai <code>TELEGRAM_WEBHOOK_SECRET</code> di env.</li>
            <li>Klik <strong>Set Webhook</strong>, lalu klik <strong>Info Webhook</strong> untuk verifikasi.</li>
            <li>Tambahkan Source (chat_id sumber) dan Target (chat_id tujuan) di menu masing-masing.</li>
            <li>Buat Rule yang menghubungkan Source ke Target dengan mode forward yang diinginkan.</li>
          </ol>
        </div>
      </section>

      {/* Telegram Admins */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Telegram Admins</h2>
          <Button id="btn-add-tg-admin" type="button" onClick={() => setAddAdminOpen(true)}>
            + Tambah Admin Telegram
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Admin Telegram dapat menggunakan perintah bot seperti /addsource, /addrule, /list, dsb.
          Dapatkan Telegram ID Anda dengan mengirim pesan ke bot lalu gunakan /whoami.
        </p>
        {loadingAdmins ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : tgAdmins.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
            Belum ada admin Telegram. Tambahkan Telegram ID Anda untuk menggunakan perintah bot.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Telegram ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nama</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ditambahkan</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tgAdmins.map((a) => (
                  <tr key={a.telegram_user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{a.telegram_user_id}</td>
                    <td className="px-4 py-3">{a.display_name ?? <span className="italic text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(a.added_at).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDelAdminId(a.telegram_user_id)}
                      >
                        Hapus
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* App Users (read-only) */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Web Admin Users</h2>
        <p className="text-sm text-muted-foreground">
          Daftar akun yang dapat login ke dashboard. Untuk menambah, gunakan Supabase Auth + bootstrap endpoint.
        </p>
        {appUsers.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
            Belum ada app user terdaftar.
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">User ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ditambahkan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {appUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]">{u.user_id}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(u.added_at).toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Panduan Perintah Bot */}
      <section className="border border-border rounded-lg p-5 space-y-3">
        <h2 className="text-lg font-medium">Perintah Bot Telegram</h2>
        <p className="text-sm text-muted-foreground">
          Perintah bot dapat digunakan langsung di chat dengan bot oleh Telegram Admin yang terdaftar.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {[
            ["/whoami", "Lihat info diri Anda (chat_id, username)"],
            ["/help", "Lihat daftar perintah"],
            ["/addsource <chat_id> [title]", "Daftarkan source baru"],
            ["/addtarget <chat_id> [title]", "Daftarkan target baru"],
            ["/addrule <src_chat_id> <tgt_chat_id> [mode]", "Buat rule baru"],
            ["/list rules|sources|targets", "Lihat daftar konfigurasi"],
            ["/pause <rule_id>", "Pause rule"],
            ["/resume <rule_id>", "Resume rule"],
            ["/setmode <rule_id> <mode>", "Ubah mode forward"],
            ["/setcooldown <rule_id> <detik>", "Set cooldown"],
            ["/queue status", "Lihat status queue"],
            ["/queue flush [rule_id]", "Reset failed queue"],
          ].map(([cmd, desc]) => (
            <div key={cmd} className="flex gap-2">
              <code className="font-mono text-primary whitespace-nowrap shrink-0">{cmd}</code>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Add Admin Dialog */}
      <Dialog open={addAdminOpen} onOpenChange={setAddAdminOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Admin Telegram</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="new-admin-id">Telegram User ID <span className="text-destructive">*</span></Label>
              <Input
                id="new-admin-id"
                type="number"
                placeholder="123456789"
                value={newAdminId}
                onChange={(e) => setNewAdminId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Kirim /whoami ke bot untuk mendapatkan ID Anda.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-admin-name">Nama (opsional)</Label>
              <Input
                id="new-admin-name"
                placeholder="John Doe"
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddAdminOpen(false)}>Batal</Button>
            <Button type="button" disabled={!newAdminId || savingAdmin} onClick={addTgAdmin}>
              {savingAdmin ? "Menyimpan..." : "Tambahkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Admin Confirm */}
      <AlertDialog open={delAdminId !== null} onOpenChange={(v) => !v && setDelAdminId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Admin Telegram?</AlertDialogTitle>
            <AlertDialogDescription>
              Admin dengan ID <strong>{delAdminId}</strong> tidak akan bisa menggunakan perintah bot lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTgAdmin} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
