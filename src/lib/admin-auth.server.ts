import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type { Env } from "@/lib/tg/types";

export type AdminRole = "admin" | "viewer" | null;

export function makeServiceClient(env: Pick<Env, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function requireSupabaseUser(
  db: SupabaseClient,
  request: Request,
): Promise<User | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function getAppRole(db: SupabaseClient, userId: string): Promise<AdminRole> {
  const { data, error } = await db
    .from("app_users")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as AdminRole | undefined) ?? null;
}
