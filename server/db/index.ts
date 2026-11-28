import "server-only";

import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { after } from "next/server";
import type { Options, Sql } from "postgres";
import { cache } from "react";

import {
  HOLD_AWAKE_MS,
  IDLE_CLOSE_SECONDS,
  maxPipeline,
  practiceDeskTarget,
  realDeskTarget,
  type DbEnv,
  type DbTarget,
} from "@/lib/db-target";
import { ensureAccessCatalog } from "@/server/db/access";
import * as schema from "@/server/db/schema";
import { isPracticeRequest } from "@/server/practice-flag";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

type Handles = { real?: Promise<Database>; practice?: Promise<Database> };
const globalForDb = globalThis as typeof globalThis & { __tmsDb?: Handles };
const handles: Handles = (globalForDb.__tmsDb ??= {});

/**
 * The database for this request: the real desk, or the practice desk (sample data for the
 * tour) when the practice cookie is set. Both are opened once per server process.
 * - `DATABASE_URL` set: Postgres (Supabase Mumbai). Practice lives in its own `practice` schema.
 * - Not set (local only): embedded PGlite in `.data/` (practice in `.data/practice`).
 */
export async function getDb(): Promise<Database> {
  holdAwakeUntilIdle();
  return (await isPracticeRequest()) ? getPracticeDb() : getRealDb();
}

/**
 * On Vercel, keep this instance awake after the response until its idle connections have
 * closed (lib/db-target.ts, HOLD_AWAKE_MS), so none is left open while the instance is paused.
 * Once per request (React `cache`). Outside a request (scripts, tests) there is nothing to hold.
 */
const holdAwakeUntilIdle = cache((): void => {
  if (!process.env.VERCEL) return;
  try {
    after(() => new Promise<void>((done) => setTimeout(done, HOLD_AWAKE_MS)));
  } catch {
    // Not inside a request: no instance to keep awake.
  }
});

/** Integration tests hand in their own in-memory databases (tests/fixtures/db.ts). */
export function setDatabasesForTest(real: Database, practice: Database): void {
  if (process.env.NODE_ENV !== "test") throw new Error("Test databases only under NODE_ENV=test.");
  handles.real = Promise.resolve(real);
  handles.practice = Promise.resolve(practice);
}

export function getRealDb(): Promise<Database> {
  // A failed start isn't remembered: the next request tries again.
  handles.real ??= connectReal().catch((err: unknown) => {
    handles.real = undefined;
    throw err;
  });
  return handles.real;
}

export function getPracticeDb(): Promise<Database> {
  handles.practice ??= connectPractice().catch((err: unknown) => {
    handles.practice = undefined;
    throw err;
  });
  return handles.practice;
}

function dbEnv(): DbEnv {
  const { DATABASE_URL, DATABASE_POOL_URL, VERCEL_ENV } = process.env;
  return { DATABASE_URL, DATABASE_POOL_URL, VERCEL_ENV };
}

async function connectReal(): Promise<Database> {
  const target = realDeskTarget(dbEnv());
  // The live tool must never fall back to a throwaway disk database.
  if (!target && process.env.VERCEL) throw new Error("DATABASE_URL is missing.");
  const t = startTimer();
  const db = target ? await postgresDb(target, "public") : await pgliteDb("pglite");
  const connect = t.lap();
  const catalog = await ensureSettings(db);
  const settings = t.lap();
  // Staging only: sample data + demo logins for testing. Never on Vercel's production env.
  const seeding =
    process.env.SEED_DEMO === "1" && (!target || process.env.VERCEL_ENV !== "production");
  if (seeding) await seedDemo(db);
  logStart("real", t, { connect, settings, catalog, seed: t.lap() });
  return db;
}

type Phases = { connect: number; settings: number; catalog: string; seed: number };

/** Millisecond stopwatch: `lap()` returns the time since the last lap. */
function startTimer() {
  const begin = performance.now();
  let last = begin;
  return {
    lap(): number {
      const now = performance.now();
      const spent = now - last;
      last = now;
      return spent;
    },
    total: () => performance.now() - begin,
  };
}

/** One line per start-up, to see in the logs what a cold instance spends its time on. */
function logStart(desk: "real" | "practice", t: { total(): number }, p: Phases): void {
  const ms = (n: number) => Math.round(n);
  // eslint-disable-next-line no-console -- the one start-up timing line, read in the Vercel logs
  console.info(
    `[db] ${desk} desk ready in ${ms(t.total())} ms (connect ${ms(p.connect)}, settings+catalog ${ms(p.settings)} ${p.catalog}, seed ${ms(p.seed)})`,
  );
}

/** Sample data + demo logins (admin, neha, ramesh, kishan) with APP_PASSWORD. */
async function seedDemo(db: Database): Promise<void> {
  const { seedDemoLogins, seedSampleIfEmpty } = await import("@/server/db/sample");
  await seedSampleIfEmpty(db);
  await seedDemoLogins(db, process.env.APP_PASSWORD ?? "demo-password");
}

async function connectPractice(): Promise<Database> {
  const target = practiceDeskTarget(dbEnv());
  const t = startTimer();
  const db = target ? await postgresDb(target, "practice") : await pgliteDb("practice");
  const connect = t.lap();
  const catalog = await ensureSettings(db);
  const settings = t.lap();
  const { seedSampleIfEmpty } = await import("@/server/db/sample");
  await seedSampleIfEmpty(db);
  logStart("practice", t, { connect, settings, catalog, seed: t.lap() });
  return db;
}

async function pgliteDb(folder: string): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // TD_DATA_DIR lets the E2E run use its own throwaway folder instead of the dev data.
  const dataDir = process.env.TD_DATA_DIR
    ? path.resolve(process.env.TD_DATA_DIR)
    : path.join(process.cwd(), ".data");
  mkdirSync(dataDir, { recursive: true });
  const db = drizzle({ client: new PGlite(path.join(dataDir, folder)), schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

/** postgres.js reads `max_pipeline` (src/index.js) but its types leave it out. */
type PoolOptions = Options<Record<string, never>> & { max_pipeline: number };

async function postgresDb(target: DbTarget, pgSchema: "public" | "practice"): Promise<Database> {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;
  // Pool sizes and which pooler each desk uses: lib/db-target.ts.
  const options: PoolOptions = {
    // Required on the transaction pooler: a prepared statement doesn't survive the transaction.
    prepare: false,
    // Transaction pooler: no pipelining, it loses replies (lib/db-target.ts, maxPipeline).
    max_pipeline: maxPipeline(target.mode),    max: target.max,
    // Close idle connections soon; each request stays awake until they have (holdAwakeUntilIdle).
    idle_timeout: IDLE_CLOSE_SECONDS,
    // Recycle each connection every 30 min so a pooler restart never leaves a dead socket for long.
    max_lifetime: 60 * 30,
    connect_timeout: 10,
    connection: {
      statement_timeout: 15_000,
      application_name: "transport-desk",
      // Only the session pooler keeps this for the connection's life; the practice desk relies on
      // it and checks it below. The real desk uses the default schema (public).
      ...(pgSchema === "practice" ? { search_path: pgSchema } : {}),
    },
  };
  const client = postgres(target.url, options);
  if (pgSchema === "practice") {
    // Hard stop: practice must never write into the real tables. If the pooler drops the
    // search_path, refuse instead of falling back to public.
    await client.unsafe("create schema if not exists practice");
    const [row] = await client<{ schema: string }[]>`select current_schema() as schema`;
    if (row?.schema !== "practice") {
      await client.end();
      throw new Error(
        "Practice desk unavailable: the database connection ignored search_path=practice.",
      );
    }
    await migratePracticeSchema(client);
  }
  return drizzle({ client, schema });
}

/**
 * Applies drizzle/ migrations inside the `practice` schema. Drizzle's SQL names "public" in
 * foreign keys, so those references are rewritten; applied tags are tracked in practice itself.
 */
async function migratePracticeSchema(client: Sql): Promise<void> {
  const folder = path.join(process.cwd(), "drizzle");
  const journal: { entries: { tag: string }[] } = JSON.parse(
    readFileSync(path.join(folder, "meta", "_journal.json"), "utf8"),
  );
  await client.unsafe("create table if not exists practice.__applied (tag text primary key)");
  const done = new Set(
    (await client<{ tag: string }[]>`select tag from practice.__applied`).map((r) => r.tag),
  );
  for (const { tag } of journal.entries) {
    if (done.has(tag)) continue;
    const sql = readFileSync(path.join(folder, `${tag}.sql`), "utf8").replaceAll(
      '"public".',
      '"practice".',
    );
    await client.begin(async (tx) => {
      for (const statement of sql.split("--> statement-breakpoint")) {
        if (statement.trim()) await tx.unsafe(statement);
      }
      await tx.unsafe("insert into practice.__applied (tag) values ($1)", [tag]);
    });
  }
}

/** The single settings row and the access catalog always exist, so reads never need a null branch. */
async function ensureSettings(db: Database): Promise<"skipped" | "synced"> {
  const [, catalog] = await Promise.all([
    db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing(),
    ensureAccessCatalog(db),
  ]);
  return catalog;
}
