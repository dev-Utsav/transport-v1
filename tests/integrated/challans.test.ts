import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { EMPTY_FORM } from "@/lib/form";
import { cancelChallan, createChallan } from "@/server/actions/challans";
import { recordPayment } from "@/server/actions/money";
import { auditLog, challans, payments, settings, vendors } from "@/server/db/schema";
import { getVendorBalance } from "@/server/queries/vendors";
import { setupTestDb } from "@/tests/fixtures/db";
import { bookChallan, expectRedirect, form, makeParty, run } from "@/tests/fixtures/factories";

const testDb = setupTestDb();

describe("booking a challan", () => {
  it("numbers challans in order and moves the counter forward", async () => {
    const { db } = testDb();
    await db.update(settings).set({ nextChallanNo: 41 });
    const a = await bookChallan(db);
    const b = await bookChallan(db);
    const rows = await db.select({ id: challans.id, no: challans.no }).from(challans);
    expect(rows.find((r) => r.id === a)?.no).toBe(41);
    expect(rows.find((r) => r.id === b)?.no).toBe(42);
    const [s] = await db.select({ next: settings.nextChallanNo }).from(settings);
    expect(s?.next).toBe(43);
  });

  it("does not use up a number when the save is refused", async () => {
    const { db } = testDb();
    const out = await run(() => createChallan(EMPTY_FORM, form({ payType: "to_pay" })));
    expect("state" in out && out.state?.ok).toBe(false);
    const [s] = await db.select({ next: settings.nextChallanNo }).from(settings);
    expect(s?.next).toBe(1);
  });

  it("keeps what was typed when refused (Paid without a payment mode)", async () => {
    const { db } = testDb();
    const sender = await makeParty(db);
    const receiver = await makeParty(db);
    const out = await run(() =>
      createChallan(
        EMPTY_FORM,
        form({
          bookedOn: "2026-11-21",
          senderId: sender.id,
          receiverId: receiver.id,
          fromPlace: "Kadodara",
          toPlace: "Delhi",
          packages: 3,
          freight: "1200",
          payType: "paid",
          gstMode: "none",
        }),
      ),
    );
    if (!("state" in out) || !out.state) throw new Error("expected a refused save");
    expect(out.state.errors.payNowMode).toBe("required");
    expect(out.state.values.freight).toBe("1200");
    expect(out.state.step).toBe(2);
  });

  it("stores the GST split once (5% extra on ₹50,000)", async () => {
    const { db } = testDb();
    const id = await bookChallan(db, { freight: "50000", gstMode: "excluded", gstRate: "5" });
    const [c] = await db.select().from(challans).where(eq(challans.id, id));
    expect(c).toMatchObject({ taxable: 5_000_000, gstAmount: 250_000, total: 5_250_000 });
    // A later rate change must not rewrite the stored challan.
    await db.update(settings).set({ gstRateBp: 1800 });
    const [again] = await db.select().from(challans).where(eq(challans.id, id));
    expect(again?.gstAmount).toBe(250_000);
  });

  it("puts To-Pay on the receiver and Paid on the sender, with the payment recorded", async () => {
    const { db } = testDb();
    const sender = await makeParty(db);
    const receiver = await makeParty(db);
    const toPay = await bookChallan(db, { senderId: sender.id, receiverId: receiver.id });
    const paid = await bookChallan(db, {
      senderId: sender.id,
      receiverId: receiver.id,
      payType: "paid",
      payNowMode: "upi",
    });
    const rows = await db.select().from(challans);
    expect(rows.find((r) => r.id === toPay)?.partyId).toBe(receiver.id);
    expect(rows.find((r) => r.id === paid)?.partyId).toBe(sender.id);
    const pays = await db.select().from(payments).where(eq(payments.challanId, paid));
    expect(pays).toHaveLength(1);
    expect(pays[0]).toMatchObject({ vendorId: sender.id, amount: 500_000, mode: "upi" });
    // Paid at booking: the sender owes nothing for it.
    expect((await getVendorBalance(sender.id))?.balance).toBe(0);
    expect((await getVendorBalance(receiver.id))?.balance).toBe(500_000);
  });

  it("creates a new party typed in place and logs both", async () => {
    const { db } = testDb();
    const receiver = await makeParty(db);
    const id = await bookChallan(db, {
      senderId: "new",
      senderNewName: "Shree Textiles",
      senderNewPhone: "98250 00000",
      receiverId: receiver.id,
    });
    const [party] = await db.select().from(vendors).where(eq(vendors.name, "Shree Textiles"));
    expect(party?.kind).toBe("sender");
    const logs = await db.select().from(auditLog);
    expect(logs.some((l) => l.entity === "vendor" && l.entityId === party?.id)).toBe(true);
    expect(logs.some((l) => l.entity === "challan" && l.entityId === id)).toBe(true);
  });
});

describe("cancelling a challan", () => {
  it("cancels its payments and drops it from the party balance", async () => {
    const { db } = testDb();
    const receiver = await makeParty(db);
    const id = await bookChallan(db, { receiverId: receiver.id });
    await expectRedirect(() =>
      recordPayment(
        EMPTY_FORM,
        form({
          vendorId: receiver.id,
          challanId: id,
          amount: "2000",
          mode: "cash",
          paidOn: "2026-11-21",
        }),
      ),
    );
    expect((await getVendorBalance(receiver.id))?.balance).toBe(300_000);

    await expectRedirect(() => cancelChallan(form({ id })));
    const live = await db
      .select()
      .from(payments)
      .where(and(eq(payments.challanId, id), eq(payments.isCancelled, false)));
    expect(live).toHaveLength(0);
    expect((await getVendorBalance(receiver.id))?.balance).toBe(0);
  });

  it("is safe to run twice (no second cancel entry)", async () => {
    const { db } = testDb();
    const id = await bookChallan(db);
    await expectRedirect(() => cancelChallan(form({ id })));
    await expectRedirect(() => cancelChallan(form({ id })));
    const cancels = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, "challan"), eq(auditLog.action, "cancel")));
    expect(cancels).toHaveLength(1);
  });

  it("logs a cancel only for payments that were still live", async () => {
    const { db } = testDb();
    const sender = await makeParty(db);
    const id = await bookChallan(db, { senderId: sender.id, payType: "paid", payNowMode: "cash" });
    const [p] = await db.select().from(payments).where(eq(payments.challanId, id));
    if (!p) throw new Error("payment missing");
    // The payment was already cancelled on its own before the challan is cancelled.
    const { cancelPayment } = await import("@/server/actions/money");
    await cancelPayment(form({ id: p.id }));
    await expectRedirect(() => cancelChallan(form({ id })));
    const paymentCancels = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entity, "payment"),
          eq(auditLog.entityId, p.id),
          eq(auditLog.action, "cancel"),
        ),
      );
    expect(paymentCancels).toHaveLength(1);
  });
});
