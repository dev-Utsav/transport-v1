// Applies drizzle/ migrations to DATABASE_URL (the live database). Local PGlite migrates itself on start.
// Safe to run on every deploy: already-applied migrations are skipped, and the run refuses
// (changes nothing) when the files and the database disagree (scripts/migrate-plan.ts).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { Sql } from "postgres";

import { planMigrations } from "./migrate-plan";
import type { AppliedRow, MigrationFile } from "./migrate-plan";

const FOLDER = "drizzle";
/** One key for this app's migrations: a second deploy waits instead of migrating at the same time. */
const LOCK_KEY = "transport-desk:migrate";
const LOCK_WAIT_MS = 5 * 60_000;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Local development migrates the embedded database on its own.",
  );
  process.exit(1);
}
// The advisory lock and session settings below need one session for the whole run: the session
// pooler (5432) or a direct connection, never the transaction pooler (6543).
if (new URL(url).port === "6543") {
  console.error("Use the Supabase session pooler (port 5432) for migrations, not 6543.");
  process.exit(1);
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** Every migration in the journal, with the hash Drizzle stores for it under LF and CRLF. */
function migrationFiles(): MigrationFile[] {
  const journal: { entries: { tag: string; when: number }[] } = JSON.parse(
    readFileSync(path.join(FOLDER, "meta", "_journal.json"), "utf8"),
  );
  return journal.entries.map((e) => {
    const lf = readFileSync(path.join(FOLDER, `${e.tag}.sql`), "utf8").replace(/\r\n/g, "\n");
    return {
      tag: e.tag,
      folderMillis: e.when,
      hashes: [sha256(lf), sha256(lf.replace(/\n/g, "\r\n"))],
    };
  });
}

async function appliedRows(sql: Sql): Promise<AppliedRow[]> {
  const [table] = await sql<{ exists: boolean }[]>`
    select to_regclass('drizzle.__drizzle_migrations') is not null as exists`;
  if (!table?.exists) return [];
  const rows = await sql<{ hash: string; created_at: string }[]>`
    select hash, created_at::text from drizzle.__drizzle_migrations`;
  return rows.map((r) => ({ hash: r.hash, createdAt: Number(r.created_at) }));
}

async function takeLock(sql: Sql): Promise<void> {
  const until = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    const [row] = await sql<{ locked: boolean }[]>`
      select pg_try_advisory_lock(hashtext(${LOCK_KEY})) as locked`;
    if (row?.locked) return;
    if (Date.now() > until) throw new Error("Another migration run held the lock for 5 minutes.");
    console.warn("Another migration run is in progress; waiting…");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

async function main(dbUrl: string): Promise<void> {
  const sql = postgres(dbUrl, {
    max: 1,
    prepare: false,
    onnotice: () => {},
    connection: { application_name: "transport-desk-migrate" },
  });
  try {
    await takeLock(sql);
    // A migration that waits behind live traffic fails fast (and rolls back) instead of
    // queueing every request behind it; a runaway statement stops after 5 minutes.
    await sql`set lock_timeout = '15s'`;
    await sql`set statement_timeout = '5min'`;

    const files = migrationFiles();
    const applied = await appliedRows(sql);
    const plan = planMigrations(files, applied);
    if (!plan.ok) {
      for (const problem of plan.problems) console.error(`✗ ${problem}`);
      throw new Error("Migrations refused: nothing was changed.");
    }
    if (plan.pending.length === 0) {
      console.warn(`Database is up to date (${applied.length} migrations applied).`);
      return;
    }
    console.warn(`Applying ${plan.pending.map((m) => m.tag).join(", ")}…`);
    // Drizzle runs all pending migrations in one transaction: all of them land, or none.
    await migrate(drizzle({ client: sql }), { migrationsFolder: FOLDER });
    console.warn(`Migrations applied (${applied.length + plan.pending.length} in total).`);
  } finally {
    await sql`select pg_advisory_unlock(hashtext(${LOCK_KEY}))`.catch(() => {});
    await sql.end();
  }
}

main(url).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
