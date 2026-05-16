import type { SupabaseClient } from "@supabase/supabase-js";
import { TelegramClient } from "./telegram";
import type { IncomingMessage } from "./transform";
import type { Env, ForwardMode } from "./types";
import { audit, isAdminUser } from "./db";

const MODES: ForwardMode[] = ["native_forward", "copy_hide_sender", "notify_only", "anonymize", "media_only", "text_only"];

function reply(tg: TelegramClient, m: IncomingMessage, text: string) {
  return tg.sendMessage({ chat_id: m.chat.id, text, parse_mode: "Markdown", disable_web_page_preview: true });
}

/**
 * Returns true if the message was handled as a command (and therefore should NOT
 * be processed by the forwarder pipeline).
 */
export async function handleCommand(
  db: SupabaseClient,
  tg: TelegramClient,
  env: Env,
  m: IncomingMessage,
): Promise<boolean> {
  const text = m.text?.trim();
  if (!text || !text.startsWith("/")) return false;

  // Admin-only commands. Determine via env or DB.
  const fromId = m.from?.id ?? 0;
  const admin = await isAdminUser(db, fromId, env);
  // /whoami works for anyone — useful for grabbing chat IDs.
  const [cmdRaw, ...args] = text.split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();

  if (cmd === "/whoami") {
    await reply(tg, m,
      `🪪 *whoami*\n` +
      `• your user id: \`${fromId}\`\n` +
      `• chat id: \`${m.chat.id}\`\n` +
      `• chat type: \`${m.chat.type ?? "?"}\`\n` +
      `• admin: \`${admin}\``);
    return true;
  }

  if (!admin) {
    // Silently ignore commands from non-admin to avoid noise
    return true;
  }

  try {
    switch (cmd) {
      case "/help":
        await reply(tg, m, helpText());
        return true;

      case "/addsource": {
        const chatId = Number(args[0]);
        const title = args.slice(1).join(" ") || null;
        if (!chatId) return reply(tg, m, "usage: `/addsource <chat_id> [title]`").then(() => true);
        const { error } = await db.from("tg_sources").upsert({ chat_id: chatId, title }, { onConflict: "chat_id" });
        if (error) await reply(tg, m, `❌ ${error.message}`);
        else { await reply(tg, m, `✅ source added: \`${chatId}\``); await audit(db, `tg:${fromId}`, "source.upsert", "tg_sources", String(chatId)); }
        return true;
      }

      case "/addtarget": {
        const chatId = Number(args[0]);
        const title = args.slice(1).join(" ") || null;
        if (!chatId) return reply(tg, m, "usage: `/addtarget <chat_id> [title]`").then(() => true);
        const { error } = await db.from("tg_targets").upsert({ chat_id: chatId, title }, { onConflict: "chat_id" });
        if (error) await reply(tg, m, `❌ ${error.message}`);
        else { await reply(tg, m, `✅ target added: \`${chatId}\``); await audit(db, `tg:${fromId}`, "target.upsert", "tg_targets", String(chatId)); }
        return true;
      }

      case "/addrule": {
        const [src, tgt, mode] = args;
        if (!src || !tgt) return reply(tg, m, "usage: `/addrule <source_chat_id> <target_chat_id> [mode]`").then(() => true);
        const fwdMode: ForwardMode = (MODES.includes(mode as ForwardMode) ? mode : "native_forward") as ForwardMode;
        const { data: s } = await db.from("tg_sources").select("id").eq("chat_id", Number(src)).maybeSingle();
        const { data: t } = await db.from("tg_targets").select("id").eq("chat_id", Number(tgt)).maybeSingle();
        if (!s || !t) return reply(tg, m, "❌ source/target belum terdaftar — pakai /addsource & /addtarget dulu.").then(() => true);
        const { data: r, error } = await db.from("tg_rules").upsert(
          { source_id: s.id, target_id: t.id, mode: fwdMode }, { onConflict: "source_id,target_id" }
        ).select("id").maybeSingle();
        if (error) await reply(tg, m, `❌ ${error.message}`);
        else { await reply(tg, m, `✅ rule \`${r?.id}\` (${fwdMode})`); await audit(db, `tg:${fromId}`, "rule.upsert", "tg_rules", r?.id); }
        return true;
      }

      case "/setmode": {
        const [ruleId, mode] = args;
        if (!MODES.includes(mode as ForwardMode)) return reply(tg, m, `mode harus salah satu: ${MODES.join(", ")}`).then(() => true);
        const { error } = await db.from("tg_rules").update({ mode }).eq("id", ruleId);
        await reply(tg, m, error ? `❌ ${error.message}` : `✅ mode → ${mode}`);
        if (!error) await audit(db, `tg:${fromId}`, "rule.setmode", "tg_rules", ruleId, { mode });
        return true;
      }

      case "/setcooldown": {
        const [ruleId, secs] = args;
        const { error } = await db.from("tg_rules").update({ cooldown_seconds: Number(secs) }).eq("id", ruleId);
        await reply(tg, m, error ? `❌ ${error.message}` : `✅ cooldown → ${secs}s`);
        return true;
      }

      case "/setquota": {
        const [ruleId, kind, n] = args;
        const col = { minute: "quota_per_minute", hour: "quota_per_hour", day: "quota_per_day" }[kind];
        if (!col) return reply(tg, m, "kind: minute|hour|day").then(() => true);
        const { error } = await db.from("tg_rules").update({ [col]: Number(n) }).eq("id", ruleId);
        await reply(tg, m, error ? `❌ ${error.message}` : `✅ ${col} → ${n}`);
        return true;
      }

      case "/setheader": {
        const ruleId = args[0];
        const tpl = args.slice(1).join(" ") || null;
        const { error } = await db.from("tg_rules").update({ header_template: tpl }).eq("id", ruleId);
        await reply(tg, m, error ? `❌ ${error.message}` : `✅ header set`);
        return true;
      }

      case "/pause":
      case "/resume": {
        const ruleId = args[0];
        const { error } = await db.from("tg_rules").update({ is_active: cmd === "/resume" }).eq("id", ruleId);
        await reply(tg, m, error ? `❌ ${error.message}` : `✅ ${cmd === "/resume" ? "resumed" : "paused"}`);
        return true;
      }

      case "/list": {
        const what = args[0] ?? "rules";
        if (what === "sources") {
          const { data } = await db.from("tg_sources").select("chat_id,title,is_active").limit(50);
          await reply(tg, m, "*sources*\n" + (data ?? []).map((s) => `• \`${s.chat_id}\` ${s.title ?? ""} ${s.is_active ? "" : "(off)"}`).join("\n"));
        } else if (what === "targets") {
          const { data } = await db.from("tg_targets").select("chat_id,title,is_active").limit(50);
          await reply(tg, m, "*targets*\n" + (data ?? []).map((s) => `• \`${s.chat_id}\` ${s.title ?? ""} ${s.is_active ? "" : "(off)"}`).join("\n"));
        } else {
          const { data } = await db.from("tg_rules")
            .select("id,mode,is_active,cooldown_seconds,quota_per_minute,source:tg_sources(chat_id,title),target:tg_targets(chat_id,title)")
            .limit(50);
          await reply(tg, m, "*rules*\n" + (data ?? []).map((r: any) =>
            `• \`${r.id.slice(0,8)}\` ${r.source?.chat_id}→${r.target?.chat_id} mode=${r.mode} cd=${r.cooldown_seconds}s qpm=${r.quota_per_minute} ${r.is_active ? "" : "(off)"}`
          ).join("\n"));
        }
        return true;
      }

      case "/queue": {
        const sub = args[0] ?? "status";
        if (sub === "status") {
          const { count: pending } = await db.from("tg_forward_queue").select("*", { count: "exact", head: true }).eq("status", "pending");
          const { count: failed } = await db.from("tg_forward_queue").select("*", { count: "exact", head: true }).eq("status", "failed");
          await reply(tg, m, `*queue*\n• pending: ${pending}\n• failed: ${failed}`);
        } else if (sub === "flush") {
          const ruleId = args[1];
          const q = ruleId ? db.from("tg_forward_queue").delete().eq("rule_id", ruleId) : db.from("tg_forward_queue").delete().neq("id", 0);
          const { error } = await q;
          await reply(tg, m, error ? `❌ ${error.message}` : "✅ flushed");
        }
        return true;
      }

      default:
        return false; // not a known command, let pipeline handle (unlikely)
    }
  } catch (e: any) {
    await reply(tg, m, `❌ error: ${e?.message ?? e}`);
    return true;
  }
}

function helpText() {
  return [
    "*Telegram Forwarder — admin commands*",
    "/whoami — tampilkan chat & user id",
    "/addsource `<chat_id>` `[title]`",
    "/addtarget `<chat_id>` `[title]`",
    "/addrule `<src_chat>` `<tgt_chat>` `[mode]`",
    "/setmode `<rule_id>` `<mode>`",
    "/setcooldown `<rule_id>` `<secs>`",
    "/setquota `<rule_id>` minute|hour|day `<n>`",
    "/setheader `<rule_id>` `<text>`",
    "/pause `<rule_id>` | /resume `<rule_id>`",
    "/list rules|sources|targets",
    "/queue status | /queue flush `[rule_id]`",
    "",
    "modes: " + MODES.join(", "),
  ].join("\n");
}