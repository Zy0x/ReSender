import { TelegramClient } from "../src/lib/tg/telegram";

type Target = "workers" | "edge";

export function readRequired(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export function readTarget(argv: string[]): Target {
  const targetArg = argv.find((arg) => arg.startsWith("--target="));
  const target = (targetArg?.slice("--target=".length) ||
    process.env.RUNTIME ||
    "workers") as Target;
  if (target !== "workers" && target !== "edge") {
    throw new Error("Target must be workers or edge");
  }
  return target;
}

export function buildWebhookUrl(target: Target): string {
  if (target === "edge") {
    const base = readRequired("PUBLIC_EDGE_BASE_URL").replace(/\/$/, "");
    return `${base}/tg-webhook`;
  }
  const base = readRequired("PUBLIC_WORKERS_BASE_URL").replace(/\/$/, "");
  return `${base}/api/public/tg/webhook`;
}

export function readTelegramClient(): TelegramClient {
  return new TelegramClient(readRequired("TELEGRAM_BOT_TOKEN"));
}
