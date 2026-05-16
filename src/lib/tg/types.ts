export type ForwardMode =
  | "native_forward"
  | "copy_hide_sender"
  | "notify_only"
  | "anonymize"
  | "media_only"
  | "text_only";

export interface Rule {
  id: string;
  source_id: string;
  target_id: string;
  mode: ForwardMode;
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
  custom_replace: { from: string; to: string; regex?: boolean }[];
  cooldown_seconds: number;
  quota_per_minute: number;
  quota_per_hour: number;
  quota_per_day: number;
  on_excess: "drop" | "queue";
  silent: boolean;
  protect_content: boolean;
  schedule_window: { tz?: string; allow_hours?: number[] } | null;
  priority: number;
  is_active: boolean;
  // joined:
  source?: { chat_id: number; title: string | null; is_active: boolean };
  target?: { chat_id: number; title: string | null; is_active: boolean };
}

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ADMIN_TELEGRAM_IDS?: string;
  ADMIN_BOOTSTRAP_SECRET?: string;
  CRON_SECRET?: string;
  GLOBAL_RPS?: string;
  QUEUE_BATCH_SIZE?: string;
}
