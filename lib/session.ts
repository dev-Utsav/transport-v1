/**
 * Stateless user session: `<userId>.<version>.<issuedAtMs>.<hmac>` signed with SESSION_SECRET.
 * The token only says who signed in and when; whether that user is still active, still on the
 * same `session_version` and what they may do is checked against the database on every request
 * (server/auth.ts). Web Crypto only, so it runs in the proxy too.
 */

export const SESSION_COOKIE = "td_session";
export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

/** Fixed secret for local development only; production refuses to run without SESSION_SECRET. */
const DEV_SECRET = "transport-desk-local-development-secret";

export type SessionClaims = { userId: number; version: number; issuedAt: number };

export function sessionSecret(
  value: string | undefined,
  nodeEnv: string | undefined,
): string | null {
  if (value) return value;
  return nodeEnv === "production" ? null : DEV_SECRET;
}

const encoder = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`transport-desk/v2/${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return btoa(String.fromCharCode(...sig))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function signSession(
  secret: string,
  user: { userId: number; version: number },
  now: number = Date.now(),
): Promise<string> {
  const message = `${user.userId}.${user.version}.${now}`;
  return `${message}.${await hmac(secret, message)}`;
}

export async function verifySession(
  secret: string,
  token: string | undefined,
  now: number = Date.now(),
): Promise<SessionClaims | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [uid, ver, issued, sig] = parts;
  const userId = Number(uid);
  const version = Number(ver);
  const issuedAt = Number(issued);
  if (
    !sig ||
    !Number.isSafeInteger(userId) ||
    userId <= 0 ||
    !Number.isSafeInteger(version) ||
    !Number.isFinite(issuedAt) ||
    now - issuedAt > SESSION_MS ||
    issuedAt > now + 60_000
  ) {
    return null;
  }
  const ok = timingSafeEqual(sig, await hmac(secret, `${uid}.${ver}.${issued}`));
  return ok ? { userId, version, issuedAt } : null;
}

/** Constant-time string compare, so the signature can't be guessed byte by byte. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
