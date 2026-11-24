import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { EMPTY_FORM } from "@/lib/form";
import { SESSION_COOKIE, sessionSecret, signSession } from "@/lib/session";
import { cancelChallan } from "@/server/actions/challans";
import { recordPayment } from "@/server/actions/money";
import { auditLog, payments, users } from "@/server/db/schema";
import { setupTestDb } from "@/tests/fixtures/db";
import { bookChallan, form, makeParty, run, signInAs } from "@/tests/fixtures/factories";
import { cookieJar } from "@/tests/fixtures/signals";

const testDb = setupTestDb({ signedIn: false });
const pay = (vendorId: number) =>
  form({ vendorId, amount: "10", mode: "cash", paidOn: "2026-11-21" });

describe("every action checks the signed-in user itself, not only the proxy", () => {
  it("refuses a write with no session, or one signed with another secret", async () => {
    const { db } = testDb();
    const party = await makeParty(db);
    await expect(recordPayment(EMPTY_FORM, pay(party.id))).rejects.toThrow("Not signed in");
    cookieJar.set(SESSION_COOKIE, await signSession("another-secret", { userId: 1, version: 1 }));
    await expect(recordPayment(EMPTY_FORM, pay(party.id))).rejects.toThrow("Not signed in");
    expect(await db.select().from(payments)).toHaveLength(0);
  });

  it("refuses a switched-off user and a session from before a version bump", async () => {
    const { db } = testDb();
    const party = await makeParty(db);
    const user = await signInAs(db, "office");
    expect("redirect" in (await run(() => recordPayment(EMPTY_FORM, pay(party.id))))).toBe(true);

    await db
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, user.id));
    await expect(recordPayment(EMPTY_FORM, pay(party.id))).rejects.toThrow("Not signed in");

    const again = await signInAs(db, "office");
    await db.update(users).set({ isActive: false }).where(eq(users.id, again.id));
    await expect(recordPayment(EMPTY_FORM, pay(party.id))).rejects.toThrow("Not signed in");
  });

  it("refuses an expired session (older than 30 days)", async () => {
    const { db } = testDb();
    const party = await makeParty(db);
    const user = await signInAs(db, "admin");
    const secret = sessionSecret(undefined, "test") ?? "";
    const old = Date.now() - 31 * 24 * 60 * 60 * 1000;
    cookieJar.set(SESSION_COOKIE, await signSession(secret, { userId: user.id, version: 1 }, old));
    await expect(recordPayment(EMPTY_FORM, pay(party.id))).rejects.toThrow("Not signed in");
  });

  it("refuses an action the role doesn't allow (office can't cancel a challan)", async () => {
    const { db } = testDb();
    await signInAs(db, "admin");
    const id = await bookChallan(db);
    await signInAs(db, "office");
    await expect(cancelChallan(form({ id }))).rejects.toThrow("Not allowed");
  });

  it("records who made each change", async () => {
    const { db } = testDb();
    const user = await signInAs(db, "office");
    const id = await bookChallan(db);
    const [entry] = await db.select().from(auditLog).where(eq(auditLog.entityId, id));
    expect(entry?.actorId).toBe(user.id);
  });
});
