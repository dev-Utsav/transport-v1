import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";

import { getRealDb } from "@/server/db";
import { roles, staff, userRoles, users } from "@/server/db/schema";

/** Logins always live in the real database (also while on the practice desk). */

/** True until the first login exists; the login page then shows "Set up the first admin". */
export async function needsFirstAdmin(): Promise<boolean> {
  const db = await getRealDb();
  const [row] = await db.select({ id: users.id }).from(users).limit(1);
  return !row;
}

/** Every login with its role keys and staff name, one query (no password hash). */
export async function listUsers() {
  const db = await getRealDb();
  return db
    .select({
      id: users.id,
      name: users.name,
      login: users.login,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      staffName: staff.name,
      roleKeys: sql<
        (string | null)[]
      >`coalesce(array_agg(${roles.key} order by ${roles.id}) filter (where ${roles.isActive}), '{}')`,
    })
    .from(users)
    .leftJoin(staff, eq(staff.id, users.staffId))
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .groupBy(users.id, staff.name)
    .orderBy(desc(users.isActive), asc(users.name))
    .limit(200);
}

export async function getUser(id: number) {
  const db = await getRealDb();
  const [[user], held] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        login: users.login,
        phone: users.phone,
        staffId: users.staffId,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, id)),
    db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, id)),
  ]);
  return user ? { ...user, roleIds: held.map((r) => r.roleId) } : null;
}

/** Active roles to pick from, system roles first. */
export async function roleOptions() {
  const db = await getRealDb();
  return db
    .select({ id: roles.id, key: roles.key, name: roles.name })
    .from(roles)
    .where(eq(roles.isActive, true))
    .orderBy(desc(roles.isSystem), asc(roles.id));
}

/** Staff a login can belong to (active, any job role). */
export async function staffForLogins() {
  const db = await getRealDb();
  return db
    .select({ id: staff.id, name: staff.name, role: staff.role })
    .from(staff)
    .where(eq(staff.isActive, true))
    .orderBy(asc(staff.name));
}
