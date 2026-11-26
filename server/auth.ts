import "server-only";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { permissionSet } from "@/lib/access";
import type { Permission } from "@/lib/access";
import { SESSION_COOKIE, sessionSecret, verifySession } from "@/lib/session";
import { getRealDb } from "@/server/db";
import { rolePermissions, roles, userRoles, users } from "@/server/db/schema";
import { env } from "@/server/env";

/** The signed-in person, as the database says right now. */
export type Actor = {
  id: number;
  name: string;
  login: string;
  staffId: number | null;
  mustChangePassword: boolean;
  permissions: ReadonlySet<Permission>;
};

export function secret(): string {
  const value = sessionSecret(env.SESSION_SECRET, env.NODE_ENV);
  if (!value) throw new Error("SESSION_SECRET is not set.");
  return value;
}

/**
 * Who is signed in, once per request: the cookie's signature, then one query for the user, their
 * active roles and those roles' permissions. Users always live in the real database (also while
 * on the practice desk). Null when not signed in, deactivated, or signed out by a version bump.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  // Cookie first: it marks the route dynamic before the secret is needed.
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySession(secret(), cookie);
  if (!claims) return null;
  const db = await getRealDb();
  const rows = await db
    .select({ user: users, permission: rolePermissions.permissionKey, roleActive: roles.isActive })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(eq(users.id, claims.userId));
  const user = rows[0]?.user;
  if (!user || !user.isActive || user.sessionVersion !== claims.version) return null;
  const keys = rows.flatMap((r) => (r.roleActive && r.permission ? [r.permission] : []));
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    staffId: user.staffId,
    mustChangePassword: user.mustChangePassword,
    permissions: permissionSet(keys),
  };
});

/**
 * The signed-in user's id from the cookie signature alone, no database. Only for the audit log:
 * every action has already checked that user with assertCan(), and logChange runs inside the
 * action's transaction, where a second query could wait on the transaction's own connection.
 */
export async function sessionUserId(): Promise<number | null> {
  // Cookie first: it marks the route dynamic before the secret is needed.
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await verifySession(secret(), cookie);
  return claims?.userId ?? null;
}

export function can(actor: Actor, ...anyOf: Permission[]): boolean {
  return anyOf.some((p) => actor.permissions.has(p));
}

/**
 * Pages: signed in (else to the login page), password changed (else to Change password), and
 * holding at least one of the permissions (else "not found", so a hidden screen isn't revealed).
 * Pass no permission for screens every signed-in person may open.
 */
export async function requireAccess(...anyOf: Permission[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (actor.mustChangePassword) redirect("/account/password");
  if (anyOf.length > 0 && !can(actor, ...anyOf)) notFound();
  return actor;
}

/** Thrown by assertCan, so guardForm can tell a refusal from a real failure. */
export class AccessError extends Error {
  constructor(readonly reason: "signedOut" | "denied") {
    super(reason === "signedOut" ? "Not signed in" : "Not allowed");
    this.name = "AccessError";
  }
}

/** Server actions and API routes: throws instead of redirecting. */
export async function assertCan(...anyOf: Permission[]): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new AccessError("signedOut");
  if (anyOf.length > 0 && !can(actor, ...anyOf)) throw new AccessError("denied");
  return actor;
}

/**
 * Which trips this person may see: null = all; otherwise only trips where trips.driver_id is
 * their staff record (a driver). A driver login with no staff link sees no trips at all.
 */
export function tripScope(actor: Actor): number | null {
  if (can(actor, "trips.all")) return null;
  return actor.staffId ?? 0;
}

/** API routes: a 401 / 403 response to return, or null when allowed. */
export async function apiDenied(...anyOf: Permission[]): Promise<Response | null> {
  const actor = await getActor();
  if (!actor) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (anyOf.length > 0 && !can(actor, ...anyOf)) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }
  return null;
}
