"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { SESSION_COOKIE, SESSION_DAYS, signSession, timingSafeEqual } from "@/lib/session";
import { env } from "@/server/env";
import { LANG_COOKIE } from "@/server/lang";

export type LoginState = { error: "wrong" | "tooMany" | null };

// Best-effort brake on password guessing: 5 tries per minute per IP, per server instance.
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string, now: number): boolean {
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 5;
}

/** Only same-site paths are allowed after login, never an absolute URL. */
const nextPath = z
  .string()
  .regex(/^\/(?!\/)[^\s]*$/)
  .catch("/");

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = env.APP_PASSWORD;
  if (!password) redirect("/");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (isRateLimited(ip, Date.now())) return { error: "tooMany" };

  const typed = String(formData.get("password") ?? "");
  if (!timingSafeEqual(typed, password)) return { error: "wrong" };

  attempts.delete(ip);
  (await cookies()).set(SESSION_COOKIE, await signSession(password), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  redirect(nextPath.parse(formData.get("next")));
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function setLang(formData: FormData): Promise<void> {
  const lang = formData.get("lang") === "hi" ? "hi" : "en";
  (await cookies()).set(LANG_COOKIE, lang, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
  });
  redirect(await samePageBack());
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
