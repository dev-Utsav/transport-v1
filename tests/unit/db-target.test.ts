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
