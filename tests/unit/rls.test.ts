import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Supabase serves the public schema over its Data API; a table without row level security is
 * readable with the project's anon key. Every table must have RLS switched on in a migration.
 */
describe("row level security", () => {
  it("every table in the schema has RLS enabled by a migration", () => {
    const schema = readFileSync("server/db/schema.ts", "utf8");
    const tables = [...schema.matchAll(/pgTable\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(15);
    const sql = readdirSync("drizzle")
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(`drizzle/${f}`, "utf8"))
      .join("\n");
    const missing = tables.filter(
      (t) => !sql.includes(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`),
    );
    expect(missing).toEqual([]);
  });
});
