import { describe, expect, it, vi } from "vitest";

import { EMPTY_FORM } from "@/lib/form";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import { cancelChallan } from "@/server/actions/challans";
import { recordPayment } from "@/server/actions/money";
import { payments } from "@/server/db/schema";
import { setupTestDb } from "@/tests/fixtures/db";
import { form, makeParty, run } from "@/tests/fixtures/factories";
import { cookieJar } from "@/tests/fixtures/signals";

// Runs before this file's imports (server/env.ts reads the password once, at import).
vi.hoisted(() => {
  process.env.APP_PASSWORD = "test-password";
});

const testDb = setupTestDb();

describe("every action checks the session itself, not only the proxy", () => {
  it("refuses a write with no session or a session signed with another password", async () => {
    const { db } = testDb();
    const party = await makeParty(db);
    const fields = form({ vendorId: party.id, amount: "10", mode: "cash", paidOn: "2026-11-21" });

    await expect(recordPayment(EMPTY_FORM, fields)).rejects.toThrow("Not signed in");
    cookieJar.set(SESSION_COOKIE, await signSession("old-password"));
    await expect(recordPayment(EMPTY_FORM, fields)).rejects.toThrow("Not signed in");
    await expect(cancelChallan(form({ id: 1 }))).rejects.toThrow("Not signed in");
    expect(await db.select().from(payments)).toHaveLength(0);

    cookieJar.set(SESSION_COOKIE, await signSession("test-password"));
    const out = await run(() => recordPayment(EMPTY_FORM, fields));
    expect("redirect" in out).toBe(true);
    expect(await db.select().from(payments)).toHaveLength(1);
  });

  it("refuses an expired session (older than 30 days)", async () => {
    const { db } = testDb();
    const party = await makeParty(db);
    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
    cookieJar.set(SESSION_COOKIE, await signSession("test-password", old));
    await expect(
      recordPayment(
        EMPTY_FORM,
        form({ vendorId: party.id, amount: "10", mode: "cash", paidOn: "2026-11-21" }),
      ),
    ).rejects.toThrow("Not signed in");
  });
});
