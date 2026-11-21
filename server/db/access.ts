import "server-only";

import { and, eq, notInArray } from "drizzle-orm";

import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLE_NAMES,
  SYSTEM_ROLES,
  isSystemRole,
} from "@/lib/access";
import type { Database } from "@/server/db";
import { permissions, rolePermissions, roles } from "@/server/db/schema";

/**
 * Runs on every start, idempotent, one transaction:
 * - permission keys from the code are inserted (and un-retired); keys the code dropped are retired;
 * - missing system roles are created with their default permissions (existing ones are left
 *   as the admin edited them); system roles the code no longer lists are switched off;
 * - the Admin role is topped up to every permission, so a new feature is never locked out.
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
    const seed = created.flatMap(({ id, key }) =>
      isSystemRole(key)
        ? DEFAULT_ROLE_PERMISSIONS[key].map((permissionKey) => ({ roleId: id, permissionKey }))
        : [],
    );
    if (seed.length > 0) await tx.insert(rolePermissions).values(seed).onConflictDoNothing();
    await tx
      .update(roles)
      .set({ isActive: false })
      .where(and(eq(roles.isSystem, true), notInArray(roles.key, [...SYSTEM_ROLES])));

    const [admin] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, "admin"));
    if (admin) {
      await tx
        .insert(rolePermissions)
        .values(PERMISSIONS.map((permissionKey) => ({ roleId: admin.id, permissionKey })))
        .onConflictDoNothing();
    }
  });
}
