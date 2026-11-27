import { describe, expect, it } from "vitest";

import { practiceDeskTarget, realDeskTarget } from "@/lib/db-target";

const session = "postgres://u:p@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
const pool = "postgres://u:p@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

describe("database targets (EMAXCONNSESSION fix, 2026-11-27)", () => {
  it("the real desk uses the transaction pooler when it is configured", () => {
    expect(realDeskTarget({ DATABASE_URL: session, DATABASE_POOL_URL: pool })).toEqual({
      url: pool,
      mode: "transaction",
      max: 3,
    });
  });

  it("the practice desk stays on the session pooler (search_path), one connection", () => {
    expect(practiceDeskTarget({ DATABASE_URL: session, DATABASE_POOL_URL: pool })).toEqual({
      url: session,
      mode: "session",
      max: 1,
    });
  });

  it("no live database configured: both desks use the embedded one", () => {
    expect(realDeskTarget({})).toBeNull();
    expect(practiceDeskTarget({})).toBeNull();
  });
});

describe("no connection left open while Vercel pauses an instance (slow clicks, 2026-11-27)", () => {
  it("each request stays awake past the idle close, by a margin", async () => {
    const { HOLD_AWAKE_MS, IDLE_CLOSE_SECONDS } = await import("@/lib/db-target");
    expect(HOLD_AWAKE_MS).toBeGreaterThanOrEqual(IDLE_CLOSE_SECONDS * 1000 + 500);
    // Short, so a quiet instance doesn't run (and bill) for long after each burst.
    expect(IDLE_CLOSE_SECONDS).toBeLessThanOrEqual(10);
  });

  it("the database module holds every request awake and uses the shared idle close", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("server/db/index.ts", "utf8");
    expect(src).toMatch(/idle_timeout:\s*IDLE_CLOSE_SECONDS/);
    expect(src).toMatch(/holdAwakeUntilIdle\(\)/);
  });
});

describe("practice desk never uses Supabase's direct host (Take the tour: ENOTFOUND, 2026-11-27)", () => {
  const direct = "postgres://postgres:p@db.abcdefghijklmnop.supabase.co:5432/postgres";
  const poolUser =
    "postgres://postgres.abcdefghijklmnop:p@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

  it("direct host (IPv6 only, unreachable from Vercel) → the session pooler on the pool's host", () => {
    expect(practiceDeskTarget({ DATABASE_URL: direct, DATABASE_POOL_URL: poolUser })).toEqual({
      url: "postgres://postgres.abcdefghijklmnop:p@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
      mode: "session",
      max: 1,
    });
  });

  it("a session pooler URL is used as it is", () => {
    expect(practiceDeskTarget({ DATABASE_URL: session, DATABASE_POOL_URL: poolUser })?.url).toBe(
      session,
    );
  });

  it("direct host with no pool URL: kept (nothing better to use)", () => {
    expect(practiceDeskTarget({ DATABASE_URL: direct })?.url).toBe(direct);
  });
});
