"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { formValues, zf } from "@/lib/form";
import type { FormState } from "@/lib/form";
import { hashPassword } from "@/lib/password";
import { logChange } from "@/server/audit";
import { assertCan } from "@/server/auth";
import type { Tx } from "@/server/db";
import { getRealDb } from "@/server/db";
import { roles, staff, userRoles, users } from "@/server/db/schema";
import { refreshDesk } from "@/server/guard";

/**
 * Settings → Users (admin only, `users.manage`). Logins are never deleted, only switched off.
 * Rules the database alone can't hold:
 * - a driver login must be linked to a driver in Staff (that link scopes their trips);
 * - there is always at least one active admin (nobody can lock the office out);
 * - nobody switches off their own login.
 */

const userSchema = z.object({
  id: zf.optionalId,
  name: zf.text,
  login: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[\p{L}\p{N}._@+-]+$/u),
  phone: zf.phone,
  staffId: zf.optionalId,
  password: z.string().max(200).default(""),
});

const fail = (values: Record<string, string>, field: string): FormState => ({
  ok: false,
  errors: { [field]: "invalid" },
  values,
});

/** Is there an active admin other than `userId`? */
async function otherActiveAdmin(tx: Tx, userId: number): Promise<boolean> {
  const [row] = await tx
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(roles.key, "admin"), eq(users.isActive, true), ne(users.id, userId)))
    .limit(1);
  return Boolean(row);
}

export async function saveUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await assertCan("users.manage");
  const values = formValues(formData);
  const roleIds = [...new Set(formData.getAll("roleIds").map(Number))].filter(
    (n) => Number.isInteger(n) && n > 0,
  );
  values.roleIds = roleIds.join(",");
  const parsed = userSchema.safeParse(values);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "name");
    return fail(values, field);
  }
  const { id, password, ...data } = parsed.data;
  if (!roleIds.length) return fail(values, "roleIds");
  if (!id && password.length < 8) return fail(values, "password");

  const db = await getRealDb();
  const [picked, linked, clash] = await Promise.all([
    db.select({ id: roles.id, key: roles.key }).from(roles).where(inArray(roles.id, roleIds)),
    data.staffId
      ? db.select({ role: staff.role }).from(staff).where(eq(staff.id, data.staffId))
      : Promise.resolve([]),
    db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.login})`, data.login.toLowerCase())),
  ]);
  if (picked.length !== roleIds.length) return fail(values, "roleIds");
  if (clash.some((u) => u.id !== id)) return fail(values, "login");
  if (picked.some((r) => r.key === "driver") && linked[0]?.role !== "driver") {
    return fail(values, "staffId");
  }
  const passwordHash = password ? await hashPassword(password) : null;

  const result = await db.transaction(async (tx) => {
    if (id) {
      const keepsAdmin = picked.some((r) => r.key === "admin");
      if (!keepsAdmin && !(await otherActiveAdmin(tx, id))) {
        const [wasAdmin] = await tx
          .select({ id: userRoles.userId })
          .from(userRoles)
          .innerJoin(roles, eq(roles.id, userRoles.roleId))
          .where(and(eq(userRoles.userId, id), eq(roles.key, "admin")));
        if (wasAdmin) return "lastAdmin";
      }
      const [before] = await tx
        .select({ name: users.name, login: users.login, staffId: users.staffId })
        .from(users)
        .where(eq(users.id, id));
      if (!before) throw new Error("User not found");
      await tx.update(users).set(data).where(eq(users.id, id));
      await tx.delete(userRoles).where(eq(userRoles.userId, id));
      await tx
        .insert(userRoles)
        .values(roleIds.map((roleId) => ({ userId: id, roleId, grantedBy: actor.id })));
      await logChange(tx, "user", id, "update", before, {
        ...data,
        roles: picked.map((r) => r.key),
      });
      return id;
    }
    if (!passwordHash) throw new Error("Password missing");
    const [created] = await tx
      .insert(users)
      .values({ ...data, passwordHash, mustChangePassword: true })
      .returning({ id: users.id });
    if (!created) throw new Error("Insert failed");
    await tx
      .insert(userRoles)
      .values(roleIds.map((roleId) => ({ userId: created.id, roleId, grantedBy: actor.id })));
    await logChange(tx, "user", created.id, "create", null, {
      ...data,
      roles: picked.map((r) => r.key),
    });
    return created.id;
  });
  if (result === "lastAdmin") return fail(values, "roleIds-lastAdmin");
  refreshDesk();
  redirect("/settings/users");
}

/** Switch a login off (signs them out at once) or back on. */
export async function toggleUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await assertCan("users.manage");
  const id = zf.id.parse(formData.get("id"));
  if (id === actor.id) return fail({}, "self");
  const db = await getRealDb();
  const result = await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, id));
    if (!before) return "missing";
    if (before.isActive && !(await otherActiveAdmin(tx, id))) {
      const [isAdmin] = await tx
        .select({ id: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(and(eq(userRoles.userId, id), eq(roles.key, "admin")));
      if (isAdmin) return "lastAdmin";
    }
    await tx.update(users).set({ isActive: !before.isActive }).where(eq(users.id, id));
    await logChange(tx, "user", id, "update", before, { isActive: !before.isActive });
    return "ok";
  });
  if (result === "lastAdmin") return fail({}, "lastAdmin");
  refreshDesk();
  redirect(`/settings/users/${id}`);
}

/** New first password; they must change it, and every device they used is signed out. */
export async function resetUserPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  await assertCan("users.manage");
  const values = formValues(formData);
  const parsed = z.object({ id: zf.id, password: z.string().min(8).max(200) }).safeParse(values);
  if (!parsed.success) return fail(values, "password");
  const { id, password } = parsed.data;
  const passwordHash = await hashPassword(password);
  const db = await getRealDb();
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: true,
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(eq(users.id, id));
    await logChange(tx, "user", id, "update", null, { password: "reset" });
  });
  redirect(`/settings/users/${id}?reset=1`);
}
