import { describe, expect, it } from "vitest";

import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, SYSTEM_ROLES, permissionSet } from "@/lib/access";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("access", () => {
  it("has exactly the agreed roles", () => {
    expect([...SYSTEM_ROLES]).toEqual(["admin", "office", "driver", "helper"]);
  });
  it("gives admin every permission and nobody else logins, settings or backups", () => {
    expect([...DEFAULT_ROLE_PERMISSIONS.admin]).toEqual([...PERMISSIONS]);
    for (const role of ["office", "driver", "helper"] as const) {
      const perms: readonly string[] = DEFAULT_ROLE_PERMISSIONS[role];
      for (const adminOnly of ["users.manage", "settings.manage", "backup.download"])
        expect(perms).not.toContain(adminOnly);
    }
  });
  it("keeps cancelling money records with the admin", () => {
    for (const role of ["office", "driver", "helper"] as const) {
      const perms: readonly string[] = DEFAULT_ROLE_PERMISSIONS[role];
      expect(perms.filter((p) => p.endsWith(".cancel"))).toEqual([]);
    }
  });
  it("lets drivers deliver and helpers load, nothing about money beyond collecting", () => {
    expect([...DEFAULT_ROLE_PERMISSIONS.driver]).toContain("trips.deliver");
    expect([...DEFAULT_ROLE_PERMISSIONS.helper]).toContain("trips.load");
    const helper: readonly string[] = DEFAULT_ROLE_PERMISSIONS.helper;
    expect(helper).not.toContain("trips.deliver");
    expect(helper).not.toContain("payments.record");
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
