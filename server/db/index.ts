import "server-only";

import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Sql } from "postgres";

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
  return (await isPracticeRequest()) ? getPracticeDb() : getRealDb();
}

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

async function connectReal(): Promise<Database> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const db = await postgresDb(url, "public");
    await ensureSettings(db);
    // Staging only: sample data + demo logins for testing. Never on Vercel's production env.
    if (process.env.SEED_DEMO === "1" && process.env.VERCEL_ENV !== "production")
      await seedDemo(db);
    return db;
  }
  // The live tool must never fall back to a throwaway disk database.
  if (process.env.VERCEL) throw new Error("DATABASE_URL is missing.");
  const db = await pgliteDb("pglite");
  await ensureSettings(db);
  if (process.env.SEED_DEMO === "1") await seedDemo(db);
  return db;
}

/** Sample data + demo logins (admin, neha, ramesh, kishan) with APP_PASSWORD. */
async function seedDemo(db: Database): Promise<void> {
  const { seedDemoLogins, seedSampleIfEmpty } = await import("@/server/db/sample");
  await seedSampleIfEmpty(db);
  await seedDemoLogins(db, process.env.APP_PASSWORD ?? "demo-password");
}

async function connectPractice(): Promise<Database> {
  const url = process.env.DATABASE_URL;
  const db = url ? await postgresDb(url, "practice") : await pgliteDb("practice");
  await ensureSettings(db);
  const { seedSampleIfEmpty } = await import("@/server/db/sample");
  await seedSampleIfEmpty(db);
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

async function postgresDb(url: string, pgSchema: "public" | "practice"): Promise<Database> {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;
  const client = postgres(url, {
    prepare: false,
    // Real desk: up to 5 connections, kept open (no idle close) so requests skip the pooler
    // handshake. Practice is used rarely: 2. Supabase's session pooler allows ~15 clients in all
    // (per project, across every Vercel instance), so raise these only with a bigger plan.
    max: pgSchema === "public" ? 5 : 2,
    idle_timeout: 0,
    // Recycle each connection every 30 min so a pooler restart never leaves a dead socket for long.
    max_lifetime: 60 * 30,
    connect_timeout: 10,
    connection: {
      statement_timeout: 15_000,
      application_name: "transport-desk",
      search_path: pgSchema,
    },
  });
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
async function ensureSettings(db: Database): Promise<void> {
  await db.insert(schema.settings).values({ id: 1 }).onConflictDoNothing();
  await ensureAccessCatalog(db);
}
