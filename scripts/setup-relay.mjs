#!/usr/bin/env node
// Script untuk setup Source + Rule secara otomatis
// Jalankan: node scripts/setup-relay.mjs <RELAY_GROUP_CHAT_ID>
//
// Contoh: node scripts/setup-relay.mjs -1001234567890

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Baca .env manual
const envFile = readFileSync(".env", "utf-8");
const envVars = Object.fromEntries(
  envFile
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const SUPABASE_URL = envVars.SUPABASE_URL;
const SUPABASE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = envVars.TELEGRAM_BOT_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY || !BOT_TOKEN) {
  console.error("❌ Env vars tidak lengkap. Cek .env");
  process.exit(1);
}

const chatIdArg = process.argv[2];
if (!chatIdArg) {
  console.error("Usage: node scripts/setup-relay.mjs <RELAY_CHAT_ID>");
  console.error("Contoh: node scripts/setup-relay.mjs -1001234567890");
  process.exit(1);
}

const relayChatId = Number(chatIdArg);
if (isNaN(relayChatId)) {
  console.error("❌ Chat ID harus angka, contoh: -1001234567890");
  process.exit(1);
}

const TARGET_CHAT_ID = -1003905658859; // RANDOM LAVENDER
const TARGET_TITLE = "RANDOM LAVENDER";

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log(`\n🔧 Setup relay: ${relayChatId} → ${TARGET_CHAT_ID}`);

  // 1. Dapatkan info chat relay via Telegram API
  let relayTitle = `Relay ${relayChatId}`;
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${relayChatId}`,
    );
    const data = await r.json();
    if (data.ok) {
      relayTitle = data.result.title ?? relayTitle;
      console.log(`✅ Chat ditemukan: "${relayTitle}" (${data.result.type})`);
    }
  } catch {}

  // 2. Upsert Source (grup relay)
  const { data: srcData, error: srcErr } = await db
    .from("tg_sources")
    .upsert(
      {
        chat_id: relayChatId,
        title: relayTitle,
        kind: "supergroup",
        is_active: true,
        notes: "Grup relay untuk forward pesan @Pixiv_bot",
      },
      { onConflict: "chat_id" },
    )
    .select("id")
    .maybeSingle();

  if (srcErr) {
    console.error("❌ Gagal insert source:", srcErr.message);
    process.exit(1);
  }
  console.log(`✅ Source upserted: id=${srcData.id}`);

  // 3. Upsert Target (RANDOM LAVENDER)
  const { data: tgtData, error: tgtErr } = await db
    .from("tg_targets")
    .upsert(
      { chat_id: TARGET_CHAT_ID, title: TARGET_TITLE, is_active: true },
      { onConflict: "chat_id" },
    )
    .select("id")
    .maybeSingle();

  if (tgtErr) {
    console.error("❌ Gagal insert target:", tgtErr.message);
    process.exit(1);
  }
  console.log(`✅ Target upserted: id=${tgtData.id}`);

  // 4. Buat Rule: source → target, mode copy_hide_sender (agar media Pixiv tetap terbawa)
  const rulePayload = {
    source_id: srcData.id,
    target_id: tgtData.id,
    mode: "copy_hide_sender",
    is_active: true,
    allow_text: true,
    allow_media: true,
    allow_links: true,
    allow_forwarded: true,
    keyword_include: [],
    keyword_exclude: [],
    min_len: 0,
    max_len: 0,
    header_template: null,
    footer_template: null,
    strip_mentions: false,
    strip_links: false,
    strip_usernames: false,
    strip_phone: false,
    custom_replace: [],
    cooldown_seconds: 0,
    quota_per_minute: 0,
    quota_per_hour: 0,
    quota_per_day: 0,
    on_excess: "queue",
    silent: false,
    protect_content: false,
    priority: 100,
  };

  const { data: ruleData, error: ruleErr } = await db
    .from("tg_rules")
    .upsert(rulePayload, { onConflict: "source_id,target_id" })
    .select("id,mode")
    .maybeSingle();

  if (ruleErr) {
    console.error("❌ Gagal insert rule:", ruleErr.message);
    process.exit(1);
  }
  console.log(`✅ Rule upserted: id=${ruleData.id}, mode=${ruleData.mode}`);

  // 5. Audit log
  await db.from("tg_audit_log").insert({
    actor: "setup-relay.mjs",
    action: "rule.create",
    entity: "tg_rules",
    entity_id: ruleData.id,
    diff: { relay: relayChatId, target: TARGET_CHAT_ID },
  });

  // 6. Kirim notifikasi ke grup target
  try {
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: TARGET_CHAT_ID,
          text:
            `✅ *Forward rule aktif!*\n\nSource: "${relayTitle}" (\`${relayChatId}\`)\nTarget: "${TARGET_TITLE}"\nMode: \`copy_hide_sender\`\n\nPerintahkan @Pixiv_bot mengirim pesan di grup relay untuk memulai!`,
          parse_mode: "Markdown",
        }),
      },
    );
  } catch {}

  console.log("\n🎉 Setup selesai! Bot akan otomatis forward dari:");
  console.log(`   Source: "${relayTitle}" (${relayChatId})`);
  console.log(`   → Target: "${TARGET_TITLE}" (${TARGET_CHAT_ID})`);
  console.log("\n📝 Langkah selanjutnya:");
  console.log("   1. Pastikan Privacy Mode bot = DISABLED (via @BotFather)");
  console.log("   2. Kirim perintah ke @Pixiv_bot di grup relay");
  console.log("   3. Pesan dari @Pixiv_bot akan diteruskan otomatis ke RANDOM LAVENDER");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
