import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { EMPTY_FORM } from "@/lib/form";
import { cancelAdvance, giveAdvance } from "@/server/actions/advances";
import { saveSalaryEntry } from "@/server/actions/salary";
import { auditLog, salaryMonths, staffAdvances } from "@/server/db/schema";
import { getAdvanceOwed, salaryRegister } from "@/server/queries/salary";
import { setupTestDb } from "@/tests/fixtures/db";
import { expectRedirect, form, makeStaff, run, signInAs } from "@/tests/fixtures/factories";

const testDb = setupTestDb();

// ₹15,000 a month; November has 30 days, so each present day earns ₹500.
const onPayroll = { onPayroll: true, monthlySalary: 1500000, joinedOn: "2025-01-01" } as const;

const advance = (staffId: number, amount: string, givenOn = "2026-11-05") =>
  form({ staffId, amount, mode: "cash", givenOn });

const salary = (staffId: number, month: string, present: number, extra = {}) =>
  form({ staffId, month, present, absent: 0, halfDays: 0, deduction: "0", ...extra });

describe("cash advances to staff", () => {
  it("records several advances in a day, with the audit entry, and comes back for the next", async () => {
    const { db } = testDb();
    const worker = await makeStaff(db, onPayroll);
    const url = await expectRedirect(() => giveAdvance(EMPTY_FORM, advance(worker.id, "200")));
    expect(url).toMatch(/^\/salary\/advances\?day=2026-11-05&saved=\d+$/);
    await expectRedirect(() => giveAdvance(EMPTY_FORM, advance(worker.id, "300")));
    const rows = await db.select().from(staffAdvances);
    expect(rows.map((r) => r.amount)).toEqual([20000, 30000]);
    const logs = await db.select().from(auditLog).where(eq(auditLog.entity, "advance"));
    expect(logs).toHaveLength(2);
    expect((await getAdvanceOwed(worker.id, "2026-11")).owed).toBe(50000);
  });

  it.each([["0"], ["-20"], ["abc"], [""]])("refuses the amount %j", async (amount) => {
    const { db } = testDb();
    const worker = await makeStaff(db, onPayroll);
    const out = await run(() => giveAdvance(EMPTY_FORM, advance(worker.id, amount)));
    expect("state" in out && out.state?.ok).toBe(false);
    expect(await db.select().from(staffAdvances)).toHaveLength(0);
  });

  it("refuses an advance to someone not on salary", async () => {
    const { db } = testDb();
    const hiredDriver = await makeStaff(db);
    const out = await run(() => giveAdvance(EMPTY_FORM, advance(hiredDriver.id, "200")));
    expect("state" in out && out.state?.errors.staffId).toBe("invalid");
    expect(await db.select().from(staffAdvances)).toHaveLength(0);
  });

  it("lets the office record advances but not a driver", async () => {
    const { db } = testDb();
    const worker = await makeStaff(db, onPayroll);
    await signInAs(db, "office");
    await expectRedirect(() => giveAdvance(EMPTY_FORM, advance(worker.id, "200")));
    await signInAs(db, "driver");
    const out = await run(() => giveAdvance(EMPTY_FORM, advance(worker.id, "200")));
    expect("state" in out && out.state?.failure).toBe("denied");
    expect(await db.select().from(staffAdvances)).toHaveLength(1);
  });

  it("takes the month's advances off the salary automatically", async () => {
    const { db } = testDb();
    const worker = await makeStaff(db, onPayroll);
    await expectRedirect(() => giveAdvance(EMPTY_FORM, advance(worker.id, "250")));
    await expectRedirect(() => giveAdvance(EMPTY_FORM, advance(worker.id, "300", "2026-11-20")));
    await expectRedirect(() => saveSalaryEntry(EMPTY_FORM, salary(worker.id, "2026-11", 30)));
    const [row] = await db.select().from(salaryMonths);
    expect(row?.advance).toBe(55000);
    const [reg] = await salaryRegister("2026-11");
    expect(reg?.pay).toMatchObject({ earned: 1500000, advanceCut: 55000, net: 1445000 });
  });

  it("shows a new advance on an unpaid month at once, without re-saving", async () => {
    const { db } = testDb();
    const worker = await makeStaff(db, onPayroll);
    await expectRedirect(() => saveSalaryEntry(EMPTY_FORM, salary(worker.id, "2026-11", 30)));
    await expectRedirect(() => giveAdvance(EMPTY_FORM, advance(worker.id, "400")));
    const [reg] = await salaryRegister("2026-11");
    expect(reg?.pay?.net).toBe(1500000 - 40000);
  });

  it("carries what the salary can't cover into next month", async () => {
    const { db } = testDb();
    const worker = await makeStaff(db, onPayroll);
    // 2 days present = ₹1,000 earned; ₹3,000 given → ₹1,000 taken off, ₹2,000 carried.
    await expectRedirect(() => giveAdvance(EMPTY_FORM, advance(worker.id, "3000")));
    await expectRedirect(() => saveSalaryEntry(EMPTY_FORM, salary(worker.id, "2026-11", 2)));
    const [nov] = await salaryRegister("2026-11");
    expect(nov?.pay).toMatchObject({ advanceCut: 100000, advanceCarried: 200000, net: 0 });

    expect((await getAdvanceOwed(worker.id, "2026-12")).owed).toBe(200000);
    await expectRedirect(() => saveSalaryEntry(EMPTY_FORM, salary(worker.id, "2026-12", 31)));
    const [dec] = await salaryRegister("2026-12");
    expect(dec?.pay).toMatchObject({ advanceCut: 200000, advanceCarried: 0, net: 1300000 });
  });

  it("keeps a paid month frozen when an advance comes later", async () => {
    const { db } = testDb();
    const worker = await makeStaff(db, onPayroll);
    await expectRedirect(() =>
      saveSalaryEntry(
        EMPTY_FORM,
        salary(worker.id, "2026-11", 30, { markPaid: "yes", paidMode: "cash", paidOn: "2026-11-30" }),
      ),
    );
    await expectRedirect(() =>
      giveAdvance(EMPTY_FORM, advance(worker.id, "500", "2026-11-30")),
    );
    const [nov] = await salaryRegister("2026-11");
    expect(nov?.pay).toMatchObject({ net: 1500000, advanceCut: 0, advanceCarried: 50000 });
    expect((await getAdvanceOwed(worker.id, "2026-12")).owed).toBe(50000);
  });

  it("cancels an advance, but not once that month's salary is paid", async () => {
    const { db } = testDb();
    const worker = await makeStaff(db, onPayroll);
    await expectRedirect(() => giveAdvance(EMPTY_FORM, advance(worker.id, "200")));
    await expectRedirect(() => giveAdvance(EMPTY_FORM, advance(worker.id, "300")));
    const [first, second] = await db.select().from(staffAdvances).orderBy(staffAdvances.id);
    if (!first || !second) throw new Error("advances missing");

    await cancelAdvance(form({ id: first.id }));
    expect((await getAdvanceOwed(worker.id, "2026-11")).owed).toBe(30000);

    await expectRedirect(() =>
      saveSalaryEntry(
        EMPTY_FORM,
        salary(worker.id, "2026-11", 30, { markPaid: "yes", paidMode: "cash", paidOn: "2026-11-30" }),
      ),
    );
    await cancelAdvance(form({ id: second.id }));
    const [after] = await db.select().from(staffAdvances).where(eq(staffAdvances.id, second.id));
    expect(after?.isCancelled).toBe(false);
  });
});
