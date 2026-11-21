import "server-only";

import { eq, notInArray } from "drizzle-orm";

import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, SYSTEM_ROLES } from "@/lib/access";
import type { Database } from "@/server/db";
import { permissions, rolePermissions, roles } from "@/server/db/schema";

const ROLE_NAMES = {
  owner: "Owner",
  manager: "Manager",
  accountant: "Accountant",
  booking_clerk: "Booking clerk",
} as const satisfies Record<(typeof SYSTEM_ROLES)[number], string>;

/**
 * Runs on every start, idempotent, one transaction:
 * - permission keys from the code are inserted (and un-retired); keys the code dropped are retired;
 * - missing system roles are created with their default permissions (existing ones are left
 *   as the owner edited them);
 * - the Owner role is topped up to every permission, so a new feature is never locked out.
 */
export async function ensureAccessCatalog(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(permissions)
      .values(PERMISSIONS.map((key) => ({ key })))
      .onConflictDoUpdate({ target: permissions.key, set: { isRetired: false } });
    await tx
      .update(permissions)
      .set({ isRetired: true })
      .where(notInArray(permissions.key, [...PERMISSIONS]));

    const created = await tx
      .insert(roles)
      .values(SYSTEM_ROLES.map((key) => ({ key, name: ROLE_NAMES[key], isSystem: true })))
      .onConflictDoNothing({ target: roles.key })
      .returning({ id: roles.id, key: roles.key });
    const seed = created.flatMap(({ id, key }) => {
      const role = SYSTEM_ROLES.find((r) => r === key);
      return role
        ? DEFAULT_ROLE_PERMISSIONS[role].map((permissionKey) => ({ roleId: id, permissionKey }))
        : [];
    });
    if (seed.length > 0) await tx.insert(rolePermissions).values(seed).onConflictDoNothing();

    const [owner] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, "owner"));
    if (owner) {
      await tx
        .insert(rolePermissions)
        .values(PERMISSIONS.map((permissionKey) => ({ roleId: owner.id, permissionKey })))
        .onConflictDoNothing();
    }
  });
}
