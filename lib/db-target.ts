/**
 * Which Postgres connection each desk uses on the live database, and how many connections one
 * server instance may hold.
 *
 * Supabase's session pooler (DATABASE_URL, port 5432) gives every client connection its own
 * server connection, 15 in all. Vercel starts a new instance per burst of requests, each with its
 * own pool, so a few instances used every slot and the rest failed with EMAXCONNSESSION
 * (2026-11-27). The transaction pooler (DATABASE_POOL_URL, port 6543) lends a server connection
 * only for one transaction, so many instances share the same 15.
 *
 * - Real desk: transaction pooler. It needs nothing from a session (plain queries and
 *   BEGIN…COMMIT; `prepare: false` because prepared statements don't survive between
 *   transactions).
 * - Practice desk: session pooler. It depends on `search_path=practice` for the whole connection,
 *   which a transaction pooler doesn't keep. One connection: it is rarely used.
 * - Migrations (scripts/migrate.ts) also stay on DATABASE_URL: they hold an advisory lock.
 */

export type DbEnv = {
  DATABASE_URL?: string | undefined;
  DATABASE_POOL_URL?: string | undefined;
  VERCEL_ENV?: string | undefined;
};

export type DbTarget = {
  url: string;
  mode: "transaction" | "session";
  /** Connections this instance may open. */
  max: number;
};

export function practiceDeskTarget(env: DbEnv): DbTarget | null {
  return env.DATABASE_URL ? { url: env.DATABASE_URL, mode: "session", max: 1 } : null;
}

export function realDeskTarget(env: DbEnv): DbTarget | null {
  if (env.DATABASE_POOL_URL) return { url: env.DATABASE_POOL_URL, mode: "transaction", max: 3 };
  if (!env.DATABASE_URL) return null; // local: embedded PGlite
  return withoutPoolUrl(env, env.DATABASE_URL);
}

/**
 * DATABASE_URL is set but DATABASE_POOL_URL is not: the session pooler is all we have.
 * TODO(you): decide what production does here. See the note in the reply.
 */
function withoutPoolUrl(env: DbEnv, sessionUrl: string): DbTarget {
  void env;
  return { url: sessionUrl, mode: "session", max: 3 };
}
