"use server";

import { eq, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";

import { hashPassword, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, SESSION_DAYS, signSession, timingSafeEqual } from "@/lib/session";
import { logChange } from "@/server/audit";
import { getActor, secret } from "@/server/auth";
import { getRealDb } from "@/server/db";
import { roles, userRoles, users } from "@/server/db/schema";
import { env } from "@/server/env";
import { LANG_COOKIE } from "@/server/lang";

export type LoginState = { error: "wrong" | "tooMany" | null };
export type SetupState = {
  error: "key" | "login" | "password" | "mismatch" | "done" | "tooMany" | null;
};
export type PasswordState = { error: "wrong" | "password" | "mismatch" | null };

// Best-effort brake on password guessing, per server instance: 5 tries a minute for one login
// name from one IP, 30 a minute from one IP in all (an office shares one IP).
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string, now: number, max = 5): boolean {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

async function clientIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/** Only same-site paths are allowed after login, never an absolute URL. */
const nextPath = z
  .string()
  .regex(/^\/(?!\/)[^\s]*$/)
  .catch("/");

const loginName = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[\p{L}\p{N}._@+-]+$/u);
const newPassword = z.string().min(8).max(200);

async function startSession(user: { id: number; sessionVersion: number }): Promise<void> {
  (await cookies()).set(
    SESSION_COOKIE,
    await signSession(secret(), { userId: user.id, version: user.sessionVersion }),
    {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    },
  );
}

// A real scrypt hash of a random string: unknown logins take as long as wrong passwords.
const DUMMY_HASH = hashPassword(crypto.randomUUID());

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const ip = await clientIp();
  const login = String(formData.get("login") ?? "").trim();
  const now = Date.now();
  if (
    isRateLimited(`ip:${ip}`, now, 30) ||
    isRateLimited(`login:${ip}:${login.toLowerCase()}`, now)
  ) {
    return { error: "tooMany" };
  }
  const password = String(formData.get("password") ?? "");
  // No real password is this long (the limit is 200); don't spend scrypt time on a 2 MB one.
  if (password.length > 200 || login.length > 40) return { error: "wrong" };
  const db = await getRealDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.login})`, login.toLowerCase()));
  const ok = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH));
  if (!user || !ok || !user.isActive) return { error: "wrong" };

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await startSession(user);
  redirect(
    user.mustChangePassword ? "/account/password" : nextPath.parse(formData.get("next")),
    RedirectType.replace,
  );
}

const setupSchema = z.object({
  key: z.string(),
  name: z.string().trim().min(1).max(100),
  login: loginName,
  password: newPassword,
  confirm: z.string(),
});

/**
 * First run only: whoever knows the setup key (APP_PASSWORD) creates the first admin login.
 * Refused once any login exists, so the key is useless afterwards.
 */
export async function setupFirstAdmin(_prev: SetupState, formData: FormData): Promise<SetupState> {
  if (isRateLimited(`setup:${await clientIp()}`, Date.now())) return { error: "tooMany" };
  const parsed = setupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "login" ? "login" : "password" };
  }
  const { key, name, login, password, confirm } = parsed.data;
  if (!env.APP_PASSWORD || !timingSafeEqual(key, env.APP_PASSWORD)) return { error: "key" };
  if (password !== confirm) return { error: "mismatch" };
  const passwordHash = await hashPassword(password);
  const db = await getRealDb();
  const created = await db.transaction(async (tx) => {
    // Locks the users table for this transaction so two first-run submits can't both win.
    await tx.execute(sql`lock table ${users} in share row exclusive mode`);
    const [existing] = await tx.select({ id: users.id }).from(users).limit(1);
    if (existing) return null;
    const [user] = await tx
      .insert(users)
      .values({ name, login, passwordHash, mustChangePassword: false })
      .returning();
    const [admin] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, "admin"));
    if (!user || !admin) throw new Error("Setup failed");
    await tx.insert(userRoles).values({ userId: user.id, roleId: admin.id, grantedBy: user.id });
    await logChange(tx, "user", user.id, "create", null, { name, login, roles: ["admin"] });
    return user;
  });
  if (!created) return { error: "done" };
  await startSession(created);
  redirect("/", RedirectType.replace);
}

const changeSchema = z.object({
  current: z.string(),
  password: newPassword,
  confirm: z.string(),
});

/** Own password. Signs out every other device (version bump) and keeps this one signed in. */
export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const actor = await getActor();
  if (!actor) redirect("/login", RedirectType.replace);
  const parsed = changeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "password" };
  const { current, password, confirm } = parsed.data;
  if (password !== confirm) return { error: "mismatch" };
  const db = await getRealDb();
  const [user] = await db.select().from(users).where(eq(users.id, actor.id));
  if (!user || !(await verifyPassword(current, user.passwordHash))) return { error: "wrong" };
  if (await verifyPassword(password, user.passwordHash)) return { error: "password" };
  const passwordHash = await hashPassword(password);
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(eq(users.id, actor.id))
      .returning();
    await logChange(tx, "user", actor.id, "update", null, { password: "changed" });
    return row;
  });
  if (updated) await startSession(updated);
  redirect("/", RedirectType.replace);
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login", RedirectType.replace);
}

export async function setLang(formData: FormData): Promise<void> {
  const lang = formData.get("lang") === "hi" ? "hi" : "en";
  (await cookies()).set(LANG_COOKIE, lang, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
  });
  redirect(await samePageBack(), RedirectType.replace);
}

/** Back to the page the form was on (from Referer), only if it is on this site. */
async function samePageBack(): Promise<string> {
  const h = await headers();
  const referer = h.get("referer");
  const host = h.get("host");
  if (!referer || !host) return "/";
  try {
    const url = new URL(referer);
    return url.host === host ? nextPath.parse(url.pathname + url.search) : "/";
  } catch {
    return "/";
  }
}
