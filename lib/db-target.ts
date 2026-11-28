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
  if (!env.DATABASE_URL) return null;
  return {
    url: sessionPoolerUrl(env.DATABASE_URL, env.DATABASE_POOL_URL),
    mode: "session",
    max: 1,
  };
}

/** Supabase's direct host, `db.<ref>.supabase.co`: IPv6 only, so Vercel can't resolve it. */
const DIRECT_HOST = /^db\.[a-z0-9]+\.supabase\.co$/;

/**
 * A session-mode URL Vercel can reach. Production's DATABASE_URL pointed at the direct host and
 * Take the tour failed with `getaddrinfo ENOTFOUND` (2026-11-27). Supavisor serves session mode
 * (5432) on the same host and login as the transaction pooler (6543), so the pool URL on 5432 is
 * the session pooler.
 */
function sessionPoolerUrl(url: string, poolUrl: string | undefined): string {
  if (!poolUrl || !DIRECT_HOST.test(new URL(url).hostname)) return url;
  const session = new URL(poolUrl);
  session.port = "5432";
  return session.toString();
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

/**
 * Queries postgres.js may queue on one connection before it waits for a reply (`max_pipeline`).
 *
 * With more parallel queries than connections, postgres.js pipelines them, and Supavisor's
 * transaction mode loses some replies: the backup's 15 reads on 3 connections hung until Vercel's
 * 300 s timeout (2026-11-28, reproduced on staging; 0 = fine 3 runs out of 3). 0 = one query at a
 * time per connection; extra queries wait in postgres.js for a free one. The session pooler gives
 * each connection its own server connection, so it keeps postgres.js's default, 100. (Always a
 * number: postgres.js reads a present `undefined` as the value, and `n < undefined` is false.)
 */
export function maxPipeline(mode: DbTarget["mode"]): number {
  return mode === "transaction" ? 0 : 100;
}

/**
 * Idle connections close after this many seconds (postgres.js `idle_timeout`).
 *
 * Vercel pauses an instance between requests. A paused instance can't run that timer, so its
 * connections stayed open, the pooler dropped them, and the next request's queries waited on
 * dead sockets: 10-19 s clicks and pages hanging for minutes (2026-11-27).
 */
export const IDLE_CLOSE_SECONDS = 5;

/**
 * How long each request keeps its instance awake after it answers (`after()`, which is
 * `waitUntil` on Vercel): until the idle connections have closed, so no connection is ever left
 * open while the instance is paused. Same idea as `attachDatabasePool` in @vercel/functions,
 * which doesn't support postgres.js.
 */
export const HOLD_AWAKE_MS = (IDLE_CLOSE_SECONDS + 1) * 1000;
