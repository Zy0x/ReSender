import { describe, expect, it } from "vitest";
import { isAppAdmin, isOwnerAdminEmail, normalizeEmail } from "./admin-auth.server";

describe("admin auth helpers", () => {
  it("normalizes email values safely", () => {
    expect(normalizeEmail("  Owner@Example.com ")).toBe("owner@example.com");
    expect(normalizeEmail(null)).toBe("");
  });

  it("matches only the configured owner email", () => {
    expect(isOwnerAdminEmail("owner@example.com", "owner@example.com")).toBe(true);
    expect(isOwnerAdminEmail("OWNER@example.com", "owner@example.com")).toBe(true);
    expect(isOwnerAdminEmail("viewer@example.com", "owner@example.com")).toBe(false);
    expect(isOwnerAdminEmail("", "owner@example.com")).toBe(false);
  });

  it("requires both admin role and owner record", async () => {
    const db = {
      from(table: string) {
        return {
          select() {
            return {
              eq(_column: string, value: string) {
                return {
                  maybeSingle: async () => {
                    if (table === "app_users") return { data: { role: "admin" }, error: null };
                    if (table === "app_owner") return { data: value === "owner-id" ? { user_id: value } : null, error: null };
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
        };
      },
    } as never;

    await expect(isAppAdmin(db, "owner-id")).resolves.toBe(true);
    await expect(isAppAdmin(db, "other-id")).resolves.toBe(false);
  });
});
