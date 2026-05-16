import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { hasSupabaseConfig, supabase } from "@/lib/tg/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bootstrapSecret, setBootstrapSecret] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!hasSupabaseConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p>Set <code>VITE_SUPABASE_URL</code> & <code>VITE_SUPABASE_ANON_KEY</code> di .env</p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setInfo(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }

    if (bootstrapSecret.trim()) {
      const res = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: {
          authorization: `Bearer ${data.session.access_token}`,
          "x-admin-bootstrap-secret": bootstrapSecret.trim(),
        },
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setLoading(false);
        setErr(payload?.error ?? "Admin bootstrap failed");
        return;
      }
      setInfo("Admin access claimed.");
    }

    const roleRes = await fetch("/api/admin/me", {
      headers: { authorization: `Bearer ${data.session.access_token}` },
    });
    const rolePayload = (await roleRes.json().catch(() => null)) as { isAdmin?: boolean } | null;
    setLoading(false);
    if (!rolePayload?.isAdmin) {
      setErr("Akun ini belum terdaftar sebagai admin.");
      return;
    }
    router.navigate({ to: "/dashboard" });
  }

  async function signUp() {
    setLoading(true);
    setErr(null);
    setInfo(null);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) setErr(error.message);
    else setInfo("Akun dibuat. Jika email confirmation aktif, cek inbox sebelum sign in.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 border border-border rounded-lg p-6 bg-card">
        <div>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">Telegram Forwarder Admin</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bootstrap-secret">Admin bootstrap secret</Label>
          <Input
            id="bootstrap-secret"
            type="password"
            value={bootstrapSecret}
            onChange={(e) => setBootstrapSecret(e.target.value)}
            placeholder="Isi hanya untuk klaim admin pertama"
          />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        {info && <p className="text-sm text-emerald-600">{info}</p>}
        <Button type="submit" disabled={loading} className="w-full">{loading ? "..." : "Sign in"}</Button>
        <Button type="button" variant="outline" disabled={loading || !email || !password} className="w-full" onClick={signUp}>
          Create Supabase account
        </Button>
        <p className="text-xs text-muted-foreground">
          Untuk admin pertama, set <code>ADMIN_BOOTSTRAP_SECRET</code> di backend lalu isi field di atas saat sign in.
          Setelah admin pertama ada, kelola admin berikutnya dari Supabase.
        </p>
      </form>
    </div>
  );
}
