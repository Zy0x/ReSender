import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./types";

export function makeAdmin(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function isAdminUser(db: SupabaseClient, telegram_user_id: number, env: Env): Promise<boolean> {
  // env bootstrap admins (comma-separated IDs)
  const bootstrap = (env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s));
  if (bootstrap.includes(telegram_user_id)) return true;
  const { data } = await db
    .from("tg_admins")
    .select("telegram_user_id")
    .eq("telegram_user_id", telegram_user_id)
    .maybeSingle();
  return !!data;
}

export async function audit(db: SupabaseClient, actor: string, action: string, entity?: string, entity_id?: string, diff?: unknown) {
  await db.from("tg_audit_log").insert({ actor, action, entity, entity_id, diff: diff as any });
}