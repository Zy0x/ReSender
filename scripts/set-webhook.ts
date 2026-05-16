import {
  buildWebhookUrl,
  readRequired,
  readTarget,
  readTelegramClient,
} from "./telegram-script-utils";

const target = readTarget(process.argv.slice(2));
const url = buildWebhookUrl(target);
const secret = readRequired("TELEGRAM_WEBHOOK_SECRET");
const tg = readTelegramClient();

await tg.setWebhook({
  url,
  secret_token: secret,
  allowed_updates: ["message", "edited_message", "channel_post", "edited_channel_post"],
});

console.log(`Webhook configured for ${target}: ${url}`);
