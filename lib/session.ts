/**
 * Stateless admin session: `<issuedAtMs>.<hmac>` signed with a key derived from APP_PASSWORD.
 * Changing the password signs everyone out. Web Crypto only, so it runs in the proxy too.
 */

export const SESSION_COOKIE = "td_session";
export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`transport-desk/v1/${secret}`),
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

export async function signSession(secret: string, now: number = Date.now()): Promise<string> {
  return `${now}.${await hmac(secret, String(now))}`;
}

export async function verifySession(
  secret: string,
  token: string | undefined,
  now: number = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const [issued, sig] = token.split(".");
  const issuedAt = Number(issued);
  if (
    !sig ||
    !Number.isFinite(issuedAt) ||
    now - issuedAt > SESSION_MS ||
    issuedAt > now + 60_000
  ) {
    return false;
  }
  return timingSafeEqual(sig, await hmac(secret, String(issuedAt)));
}

/** Constant-time string compare, so the signature can't be guessed byte by byte. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
