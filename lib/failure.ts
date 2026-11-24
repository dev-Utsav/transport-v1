import type { SaveFailure } from "@/lib/form";

/**
 * The error code under a thrown error, if any. Drizzle wraps driver errors (`DrizzleQueryError`)
 * and keeps the original in `cause`; postgres.js and PGlite put the SQLSTATE (e.g. "23505") in
 * `code`, and network failures carry Node / postgres.js codes ("ECONNRESET", "CONNECT_TIMEOUT").
 */
export function errorCode(err: unknown): string | null {
  for (let e = err, depth = 0; e && typeof e === "object" && depth < 5; depth++) {
    if ("code" in e && typeof e.code === "string") return e.code;
    e = "cause" in e ? e.cause : null;
  }
  return null;
}

/**
 * What a failed save means to the person at the desk, from the error code (see errorCode).
 * - "busy":   worth pressing Save again in a moment (connection dropped, timeout, lock clash)
 * - "taken":  someone else already saved the same thing (a unique value clashed)
 * - "server": anything else; nothing was saved, quote the reference to support
 * Postgres codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export function classifyFailure(code: string | null): SaveFailure {
  // TODO(you): map the codes that matter for a 5–6 person office on Supabase.
  void code;
  return "server";
}
