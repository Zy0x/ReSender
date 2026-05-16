import { readTelegramClient } from "./telegram-script-utils";

const dropPendingUpdates = process.argv.includes("--drop-pending-updates");
const tg = readTelegramClient();

await tg.deleteWebhook({ drop_pending_updates: dropPendingUpdates });

console.log(`Webhook deleted. drop_pending_updates=${dropPendingUpdates}`);
