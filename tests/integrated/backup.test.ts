import { is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import { exportAll } from "@/server/backup";
import * as schema from "@/server/db/schema";
import { PRACTICE_COOKIE } from "@/server/practice-flag";
import { setupTestDb } from "@/tests/fixtures/db";
import { makeStaff } from "@/tests/fixtures/factories";
import { cookieJar } from "@/tests/fixtures/signals";

const testDb = setupTestDb();

/** Tables a backup leaves out on purpose. */
const NOT_BACKED_UP = new Set([
  "backups", // the snapshots themselves
  "permissions", // rebuilt from lib/access.ts on every start
]);

const exported = async (): Promise<Record<string, unknown[]>> =>
  JSON.parse(await exportAll()).tables;

describe("backup export (staff advances missing, 2026-11-28)", () => {
  it("holds every table in the schema, so a new table can't be left out again", async () => {
    const tables = Object.entries(schema)
      .filter(([name, value]) => is(value, PgTable) && !NOT_BACKED_UP.has(name))
      .map(([name]) => name);
    expect(Object.keys(await exported()).sort()).toEqual(tables.sort());
  });

  it("reads every table in one read-only snapshot, one query at a time (backup 504, 2026-11-28)", async () => {
    const { db } = testDb();
    const spy = vi.spyOn(db, "transaction");
    await exportAll();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
    spy.mockRestore();
  });

  it("on the practice desk it still backs up the real records, never the sample data", async () => {
    const { db, practice } = testDb();
    await makeStaff(db, { name: "Real driver" });
    await makeStaff(practice, { name: "Sample driver" });
    cookieJar.set(PRACTICE_COOKIE, "1");
    const { staff } = await exported();
    expect(staff).toEqual([expect.objectContaining({ name: "Real driver" })]);
  });

  it("carries the staff advances khata rows", async () => {
    const { db } = testDb();
    const worker = await makeStaff(db);
    await db
      .insert(schema.staffAdvances)
      .values({ staffId: worker.id, amount: 50000, mode: "cash", givenOn: "2026-11-05" });
    const { staffAdvances } = await exported();
    expect(staffAdvances).toEqual([
      expect.objectContaining({ staffId: worker.id, amount: 50000, givenOn: "2026-11-05" }),
    ]);
  });
});
