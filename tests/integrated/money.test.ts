import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { EMPTY_FORM } from "@/lib/form";
import { deliverChallan } from "@/server/actions/flow";
import { recordPayment } from "@/server/actions/money";
import { challans, payments } from "@/server/db/schema";
import { getVendorBalance } from "@/server/queries/vendors";
import { setupTestDb } from "@/tests/fixtures/db";
import { bookChallan, expectRedirect, form, makeParty, run } from "@/tests/fixtures/factories";

const testDb = setupTestDb();

describe("recording a payment", () => {
  it("refuses a payment against a challan from a party who doesn't owe it", async () => {
    const { db } = testDb();
    const sender = await makeParty(db);
    const receiver = await makeParty(db);
    const id = await bookChallan(db, { senderId: sender.id, receiverId: receiver.id });
    const out = await run(() =>
      recordPayment(
        EMPTY_FORM,
        form({
          vendorId: sender.id,
          challanId: id,
          amount: "100",
          mode: "cash",
          paidOn: "2026-11-21",
        }),
      ),
    );
    expect("state" in out && out.state?.errors.challanId).toBe("invalid");
    expect(await db.select().from(payments)).toHaveLength(0);
  });

  it.each([["0"], ["-50"], ["abc"], ["1.234"], [""]])("refuses the amount %j", async (amount) => {
    const { db } = testDb();
    const party = await makeParty(db);
    const out = await run(() =>
      recordPayment(
        EMPTY_FORM,
        form({ vendorId: party.id, amount, mode: "cash", paidOn: "2026-11-21" }),
      ),
    );
    expect("state" in out && out.state?.ok).toBe(false);
    expect(await db.select().from(payments)).toHaveLength(0);
  });

  it("only sends the user back to a path on this site", async () => {
    const { db } = testDb();
    const party = await makeParty(db);
    const url = await expectRedirect(() =>
      recordPayment(
        EMPTY_FORM,
        form({
          vendorId: party.id,
          amount: "10",
          mode: "cash",
          paidOn: "2026-11-21",
          back: "//evil.example",
        }),
      ),
    );
    expect(url.startsWith(`/vendors/${party.id}`)).toBe(true);
  });
});

describe("deliver and collect (To-Pay)", () => {
  it("collects exactly what is still due, once", async () => {
    const { db } = testDb();
    const receiver = await makeParty(db);
    const id = await bookChallan(db, { receiverId: receiver.id, freight: "5000" });
    await expectRedirect(() =>
      recordPayment(
        EMPTY_FORM,
        form({
          vendorId: receiver.id,
          challanId: id,
          amount: "1500",
          mode: "cash",
          paidOn: "2026-11-21",
        }),
      ),
    );
    await expectRedirect(() => deliverChallan(form({ id, mode: "upi" })));
    // A double tap must not take the money twice.
    await expectRedirect(() => deliverChallan(form({ id, mode: "upi" })));

    const pays = await db.select().from(payments).where(eq(payments.challanId, id));
    expect(pays.map((p) => p.amount).sort()).toEqual([150_000, 350_000]);
    const [c] = await db.select().from(challans).where(eq(challans.id, id));
    expect(c?.status).toBe("delivered");
    expect((await getVendorBalance(receiver.id))?.balance).toBe(0);
  });

  it("does nothing to a cancelled challan", async () => {
    const { db } = testDb();
    const id = await bookChallan(db);
    await db.update(challans).set({ isCancelled: true }).where(eq(challans.id, id));
    await expectRedirect(() => deliverChallan(form({ id, mode: "cash" })));
    const [c] = await db.select().from(challans).where(eq(challans.id, id));
    expect(c?.status).toBe("booked");
    expect(await db.select().from(payments)).toHaveLength(0);
  });
});
