import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach } from "vitest";

import type { Database } from "@/server/db";
import { setDatabasesForTest } from "@/server/db";
import { ensureAccessCatalog } from "@/server/db/access";
import * as schema from "@/server/db/schema";

/**
 * The test database: in-memory Postgres (PGlite), never a file and never DATABASE_URL.
 * The real migrations run once per test file into a snapshot; every test boots a copy of it,
 * so tests can't see each other's rows and nothing leaks into .data/.
 */
let template: Promise<File | Blob> | undefined;

/** The migrated empty database as a data-dir snapshot; each test boots its own copy from it. */
function migratedTemplate(): Promise<File | Blob> {
  template ??= (async () => {
    const client = new PGlite();
    const db = drizzle({ client, schema });
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    await db.insert(schema.settings).values({ id: 1 });
    await ensureAccessCatalog(db);
    const snapshot = await client.dumpDataDir("none");
    await client.close();
    return snapshot;
  })();
  return template;
}

export type TestDb = { db: Database; practice: Database };

/** Call at the top of a test file. Returns a getter for the current test's database. */
export function setupTestDb(): () => TestDb {
  let current: (TestDb & { close: () => Promise<void> }) | undefined;
  beforeEach(async () => {
    const snapshot = await migratedTemplate();
    const realClient = new PGlite({ loadDataDir: snapshot });
    const practiceClient = new PGlite({ loadDataDir: snapshot });
    const db = drizzle({ client: realClient, schema });
    const practice = drizzle({ client: practiceClient, schema });
    setDatabasesForTest(db, practice);
    current = {
      db,
      practice,
      close: async () => {
        await Promise.all([realClient.close(), practiceClient.close()]);
      },
    };
  });
  afterEach(async () => {
    await current?.close();
    current = undefined;
  });
  return () => {
    if (!current) throw new Error("setupTestDb(): no database outside a test");
    return current;
  };
}
