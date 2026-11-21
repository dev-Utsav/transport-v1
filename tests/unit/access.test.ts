import { describe, expect, it } from "vitest";

import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, permissionSet } from "@/lib/access";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("access", () => {
  it("gives the owner every permission and nobody else users.manage", () => {
    expect([...DEFAULT_ROLE_PERMISSIONS.owner]).toEqual([...PERMISSIONS]);
    for (const role of ["manager", "accountant", "booking_clerk"] as const) {
      const perms: readonly string[] = DEFAULT_ROLE_PERMISSIONS[role];
      expect(perms).not.toContain("users.manage");
    }
  });
  it("merges roles and drops keys the code no longer knows", () => {
    const set = permissionSet(["challans.view", "challans.view", "old.key"]);
    expect([...set]).toEqual(["challans.view"]);
  });
});

describe("password", () => {
  it("verifies its own hash and rejects others", async () => {
    const stored = await hashPassword("kadodara");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("kadodara", stored)).toBe(true);
    expect(await verifyPassword("Kadodara", stored)).toBe(false);
    expect(await verifyPassword("kadodara", "garbage")).toBe(false);
  });
});
