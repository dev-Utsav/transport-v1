import { describe, expect, it } from "vitest";

import { planMigrations } from "@/scripts/migrate-plan";
import type { MigrationFile } from "@/scripts/migrate-plan";

const files: MigrationFile[] = [
  { tag: "0000_init", folderMillis: 100, hashes: ["a", "a-crlf"] },
  { tag: "0001_rls", folderMillis: 200, hashes: ["b", "b-crlf"] },
  { tag: "0002_new", folderMillis: 300, hashes: ["c", "c-crlf"] },
];

describe("planMigrations (production migration guard)", () => {
  it("a fresh database gets every migration", () => {
    expect(planMigrations(files, [])).toEqual({ ok: true, pending: files });
  });

  it("only the new migration is pending after earlier deploys", () => {
    const plan = planMigrations(files, [
      { hash: "a", createdAt: 100 },
      { hash: "b", createdAt: 200 },
    ]);
    expect(plan).toEqual({ ok: true, pending: [files[2]] });
  });

  it("running again when everything is applied does nothing (idempotent)", () => {
    const all = files.map((f) => ({ hash: f.hashes[0] ?? "", createdAt: f.folderMillis }));
    expect(planMigrations(files, all)).toEqual({ ok: true, pending: [] });
  });

  it("refuses when an applied migration file was edited", () => {
    const plan = planMigrations(files, [{ hash: "EDITED", createdAt: 100 }]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.problems[0]).toMatch(/0000_init was edited/);
  });

  it("refuses to run older code against a newer database", () => {
    const plan = planMigrations(files.slice(0, 2), [
      { hash: "a", createdAt: 100 },
      { hash: "b", createdAt: 200 },
      { hash: "c", createdAt: 300 },
    ]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.problems[0]).toMatch(/doesn't have/);
  });

  it("refuses a new migration dated before the last applied one (Drizzle would skip it)", () => {
    const late: MigrationFile[] = [
      ...files,
      { tag: "0003_backdated", folderMillis: 250, hashes: ["d", "d-crlf"] },
    ];
    const all = files.map((f) => ({ hash: f.hashes[0] ?? "", createdAt: f.folderMillis }));
    const plan = planMigrations(late, all);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.problems[0]).toMatch(/0003_backdated is dated before/);
  });
});

describe("planMigrations and line endings", () => {
  it("accepts a migration applied from a Windows (CRLF) checkout", () => {
    const plan = planMigrations(files, [
      { hash: "a-crlf", createdAt: 100 },
      { hash: "b", createdAt: 200 },
    ]);
    expect(plan).toEqual({ ok: true, pending: [files[2]] });
  });
});
