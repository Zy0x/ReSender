import type { Rule, ForwardMode } from "./types";
import type { TelegramClient } from "./telegram";

const RE_MENTION = /@[A-Za-z0-9_]{3,}/g;
const RE_LINK = /\bhttps?:\/\/\S+|\bt\.me\/\S+/gi;
const RE_USERNAME = /\b[a-z0-9_]{4,}\b/gi; // soft, paired with strip_usernames
const RE_PHONE = /(\+?\d[\d \-()]{6,}\d)/g;

export interface IncomingMessage {
  message_id: number;
  chat: { id: number; title?: string; type?: string };
  from?: { id: number; username?: string; first_name?: string };
  text?: string;
  caption?: string;
  forward_from?: unknown;
  forward_origin?: unknown;
  photo?: unknown;
  video?: unknown;
  document?: unknown;
  audio?: unknown;
  voice?: unknown;
  sticker?: unknown;
  animation?: unknown;
  media_group_id?: string;
  entities?: unknown;
  caption_entities?: unknown;
}

export function hasMedia(m: IncomingMessage): boolean {
  return !!(m.photo || m.video || m.document || m.audio || m.voice || m.sticker || m.animation);
}

export function passesFilter(m: IncomingMessage, r: Rule): { ok: boolean; reason?: string } {
  const text = m.text ?? m.caption ?? "";
  const isMedia = hasMedia(m);
  const isText = !!m.text;

  if (!r.allow_text && isText && !isMedia) return { ok: false, reason: "text not allowed" };
  if (!r.allow_media && isMedia) return { ok: false, reason: "media not allowed" };
  if (!r.allow_forwarded && (m.forward_from || m.forward_origin)) return { ok: false, reason: "forwarded not allowed" };
  if (!r.allow_links && RE_LINK.test(text)) return { ok: false, reason: "link not allowed" };
  if (r.mode === "media_only" && !isMedia) return { ok: false, reason: "media_only" };
  if (r.mode === "text_only" && isMedia) return { ok: false, reason: "text_only" };
  if (r.min_len > 0 && text.length < r.min_len) return { ok: false, reason: "min_len" };
  if (r.max_len > 0 && text.length > r.max_len) return { ok: false, reason: "max_len" };

  for (const kw of r.keyword_exclude ?? []) {
    if (kw && new RegExp(kw, "i").test(text)) return { ok: false, reason: `excluded:${kw}` };
  }
  if ((r.keyword_include ?? []).length > 0) {
    const ok = r.keyword_include.some((kw) => kw && new RegExp(kw, "i").test(text));
    if (!ok) return { ok: false, reason: "no include match" };
  }

  if (r.schedule_window?.allow_hours?.length) {
    const now = new Date();
    const hour = now.getUTCHours();
    if (!r.schedule_window.allow_hours.includes(hour)) {
      return { ok: false, reason: "outside schedule" };
    }
  }
  return { ok: true };
}

function applyTextTransform(text: string, r: Rule): string {
  let out = text;
  if (r.strip_mentions) out = out.replace(RE_MENTION, "");
  if (r.strip_links) out = out.replace(RE_LINK, "");
  if (r.strip_phone) out = out.replace(RE_PHONE, "");
  if (r.strip_usernames) out = out.replace(RE_USERNAME, (s) => (s.length > 4 ? "***" : s));
  for (const cr of r.custom_replace ?? []) {
    if (!cr?.from) continue;
    if (cr.regex) {
      try {
        out = out.replace(new RegExp(cr.from, "g"), cr.to ?? "");
      } catch {
        /* ignore bad regex */
      }
    } else {
      out = out.split(cr.from).join(cr.to ?? "");
    }
  }
  return out.trim();
}

function applyTemplate(tpl: string | null | undefined, r: Rule, m: IncomingMessage): string {
  if (!tpl) return "";
  return tpl
    .replaceAll("{source_title}", r.source?.title ?? String(m.chat.id))
    .replaceAll("{source_id}", String(m.chat.id))
    .replaceAll("{date}", new Date().toISOString())
    .replaceAll("{sender_initial}", (m.from?.first_name ?? "?").slice(0, 1));
}

/**
 * Build the actual Telegram API call(s) for a (rule, message) pair.
 * Returns an array (usually 1) of { method, payload } executable by TelegramClient.call.
 */
export function buildCalls(rule: Rule, m: IncomingMessage, targetChatId: number) {
  const baseDelivery = {
    disable_notification: rule.silent || undefined,
    protect_content: rule.protect_content || undefined,
  };
  const mode: ForwardMode = rule.mode;
  const text = m.text ?? m.caption ?? "";
  const transformed = applyTextTransform(text, rule);
  const header = applyTemplate(rule.header_template, rule, m);
  const footer = applyTemplate(rule.footer_template, rule, m);
  const decorated = [header, transformed, footer].filter(Boolean).join("\n");

  if (mode === "native_forward") {
    return [{
      method: "forwardMessage",
      payload: { chat_id: targetChatId, from_chat_id: m.chat.id, message_id: m.message_id, ...baseDelivery },
    }];
  }

  if (mode === "notify_only") {
    const summary =
      `📨 Pesan baru di *${(rule.source?.title ?? "source").replace(/[*_`[\]]/g, "")}*\n` +
      `• panjang: ${text.length} karakter\n` +
      `• media: ${hasMedia(m) ? "ya" : "tidak"}`;
    return [{
      method: "sendMessage",
      payload: { chat_id: targetChatId, text: summary, parse_mode: "Markdown", disable_web_page_preview: true, ...baseDelivery },
    }];
  }

  // copy_hide_sender / anonymize / media_only / text_only:
  // copyMessage by default hides the original sender; we just override caption when we have text changes.
  const captionForCopy = hasMedia(m)
    ? (decorated || undefined)
    : undefined; // for plain-text messages, copyMessage carries the text already

  if (!hasMedia(m)) {
    // Plain text: send the (possibly transformed) text fresh so we control content.
    return [{
      method: "sendMessage",
      payload: {
        chat_id: targetChatId,
        text: decorated || transformed || text,
        disable_web_page_preview: rule.strip_links || undefined,
        ...baseDelivery,
      },
    }];
  }

  return [{
    method: "copyMessage",
    payload: {
      chat_id: targetChatId,
      from_chat_id: m.chat.id,
      message_id: m.message_id,
      caption: captionForCopy,
      ...baseDelivery,
    },
  }];
}

export async function dispatch(tg: TelegramClient, calls: ReturnType<typeof buildCalls>) {
  for (const c of calls) {
    await tg.call(c.method, c.payload);
  }
}