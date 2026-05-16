// Minimal Telegram Bot API client using fetch (works in any runtime).
const API = "https://api.telegram.org";

export class TelegramClient {
  constructor(private token: string) {}

  async call<T = any>(method: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${API}/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; result?: T; description?: string; parameters?: { retry_after?: number } };
    if (!data.ok) {
      const err: any = new Error(`Telegram ${method} failed: ${data.description}`);
      err.retry_after = data.parameters?.retry_after;
      err.status = res.status;
      throw err;
    }
    return data.result as T;
  }

  forwardMessage(p: { chat_id: number; from_chat_id: number; message_id: number; disable_notification?: boolean; protect_content?: boolean }) {
    return this.call("forwardMessage", p);
  }

  copyMessage(p: { chat_id: number; from_chat_id: number; message_id: number; caption?: string; parse_mode?: string; disable_notification?: boolean; protect_content?: boolean }) {
    return this.call("copyMessage", p);
  }

  sendMessage(p: { chat_id: number; text: string; parse_mode?: string; disable_web_page_preview?: boolean; disable_notification?: boolean; protect_content?: boolean }) {
    return this.call("sendMessage", p);
  }

  setWebhook(p: { url: string; secret_token: string; allowed_updates?: string[]; drop_pending_updates?: boolean }) {
    return this.call("setWebhook", p);
  }

  deleteWebhook(p: { drop_pending_updates?: boolean } = {}) {
    return this.call("deleteWebhook", p);
  }

  getMe() {
    return this.call("getMe", {});
  }

  getWebhookInfo() {
    return this.call("getWebhookInfo", {});
  }
}