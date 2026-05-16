import { afterEach, describe, expect, it } from "vitest";
import { getQueueBatchSize, readAdminBootstrapEnv, readQueueEnv } from "./env.server";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("telegram server env", () => {
  it("fails closed when queue cron secret is missing", () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    delete process.env.CRON_SECRET;

    expect(() => readQueueEnv()).toThrow(/CRON_SECRET/);
  });

  it("bounds queue batch size", () => {
    expect(getQueueBatchSize({ QUEUE_BATCH_SIZE: "0" })).toBe(1);
    expect(getQueueBatchSize({ QUEUE_BATCH_SIZE: "250" })).toBe(100);
    expect(getQueueBatchSize({ QUEUE_BATCH_SIZE: "not-a-number" })).toBe(25);
  });

  it("requires owner admin email for bootstrap env", () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.ADMIN_BOOTSTRAP_SECRET = "bootstrap-secret";
    delete process.env.ADMIN_ACCOUNT;

    expect(() => readAdminBootstrapEnv()).toThrow(/ADMIN_ACCOUNT/);
  });
});
