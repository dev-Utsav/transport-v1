import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "@/lib/access";
import { ensureAccessCatalog } from "@/server/db/access";
import { rolePermissions, roles } from "@/server/db/schema";
import { setupTestDb } from "@/tests/fixtures/db";

const testDb = setupTestDb();

async function permsOf(db: ReturnType<typeof testDb>["db"], key: string) {
  const rows = await db
    .select({ p: rolePermissions.permissionKey })
    .from(rolePermissions)
    .innerJoin(roles, eq(roles.id, rolePermissions.roleId))
    .where(eq(roles.key, key));
  return rows.map((r) => r.p).sort();
}

describe("access catalog sync on start", () => {
  it("seeds admin, office, driver and helper with their defaults", async () => {
    const { db } = testDb();
    const keys = (await db.select({ key: roles.key }).from(roles)).map((r) => r.key).sort();
    expect(keys).toEqual(["admin", "driver", "helper", "office"]);
    expect(await permsOf(db, "admin")).toEqual([...PERMISSIONS].sort());
    expect(await permsOf(db, "helper")).toEqual([...DEFAULT_ROLE_PERMISSIONS.helper].sort());
  });

  it("keeps an admin's edits to a role, and tops admin back up", async () => {
    const { db } = testDb();
    const [office] = await db.select().from(roles).where(eq(roles.key, "office"));
    const [admin] = await db.select().from(roles).where(eq(roles.key, "admin"));
    if (!office || !admin) throw new Error("roles missing");
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, office.id));
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, admin.id));

    await ensureAccessCatalog(db);
    expect(await permsOf(db, "office")).toEqual([]);
    expect(await permsOf(db, "admin")).toEqual([...PERMISSIONS].sort());
  });

  it("switches off a system role the code no longer lists", async () => {
    const { db } = testDb();
    await db.insert(roles).values({ key: "manager", name: "Manager", isSystem: true });
    await ensureAccessCatalog(db);
    const [old] = await db.select().from(roles).where(eq(roles.key, "manager"));
    expect(old?.isActive).toBe(false);
  });
});
