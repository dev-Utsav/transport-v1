import "server-only";

import { and, asc, desc, eq, gte, lt, lte, or, sql } from "drizzle-orm";

import { monthRange } from "@/lib/dates";
import { calcSalary } from "@/lib/salary";
import type { SalaryResult } from "@/lib/salary";
import { getDb } from "@/server/db";
import type { Database } from "@/server/db";
import { salaryMonths, staff, staffAdvances } from "@/server/db/schema";

/**
 * Per person, as two grouped subqueries to join (one round trip with the caller's query):
 * - given: advances up to the month's end (`upTo`) and within the month (`inMonth`);
 * - taken: advance already taken off by earlier months' salary.
 * Owed this month = upTo − taken (never below zero).
 */
function advanceTotals(db: Database, month: string) {
  const { from, to } = monthRange(month);
  const given = db
    .select({
      staffId: staffAdvances.staffId,
      upTo: sql<number>`coalesce(sum(${staffAdvances.amount}), 0)::int`.as("up_to"),
      inMonth:
        sql<number>`coalesce(sum(${staffAdvances.amount}) filter (where ${staffAdvances.givenOn} >= ${from}), 0)::int`.as(
          "in_month",
        ),
    })
    .from(staffAdvances)
    .where(and(eq(staffAdvances.isCancelled, false), lte(staffAdvances.givenOn, to)))
    .groupBy(staffAdvances.staffId)
    .as("given");
  const taken = db
    .select({
      staffId: salaryMonths.staffId,
      taken: sql<number>`coalesce(sum(${salaryMonths.advance}), 0)::int`.as("taken"),
    })
    .from(salaryMonths)
    .where(lt(salaryMonths.month, month))
    .groupBy(salaryMonths.staffId)
    .as("taken");
  return { given, taken };
}

const owed = (upTo: number | null, taken: number | null) => Math.max(0, (upTo ?? 0) - (taken ?? 0));

/**
 * Pay for a month. Unpaid: works with what is owed right now, so a new advance shows at once.
 * Paid: frozen at what was taken off on the day it was paid; the rest shows as carried.
 */
export function payFor(
  entry: typeof salaryMonths.$inferSelect,
  month: string,
  advanceOwed: number,
): SalaryResult {
  if (!entry.paidOn) return calcSalary({ ...entry, month, advance: advanceOwed });
  const frozen = calcSalary({ ...entry, month });
  return { ...frozen, advanceCarried: Math.max(0, advanceOwed - entry.advance) };
}

/** What one person owes in advances at a month's end (used by the save, inside its transaction). */
export async function advanceOwedFor(db: Database, staffId: number, month: string) {
  const { given, taken } = advanceTotals(db, month);
  const [row] = await db
    .select({ upTo: given.upTo, inMonth: given.inMonth, taken: taken.taken })
    .from(staff)
    .leftJoin(given, eq(given.staffId, staff.id))
    .leftJoin(taken, eq(taken.staffId, staff.id))
    .where(eq(staff.id, staffId));
  return { owed: owed(row?.upTo ?? 0, row?.taken ?? 0), inMonth: row?.inMonth ?? 0 };
}

/**
 * Everyone on payroll that month (joined by its last day; hidden or off-payroll staff only if
 * they have an entry), with the month's entry if one exists and the computed pay.
 */
export async function salaryRegister(month: string) {
  const db = await getDb();
  const { to } = monthRange(month);
  const { given, taken } = advanceTotals(db, month);
  const rows = await db
    .select({
      employee: staff,
      entry: salaryMonths,
      upTo: given.upTo,
      inMonth: given.inMonth,
      taken: taken.taken,
    })
    .from(staff)
    .leftJoin(salaryMonths, and(eq(salaryMonths.staffId, staff.id), eq(salaryMonths.month, month)))
    .leftJoin(given, eq(given.staffId, staff.id))
    .leftJoin(taken, eq(taken.staffId, staff.id))
    .where(
      and(
        lte(staff.joinedOn, to),
        or(
          and(eq(staff.onPayroll, true), eq(staff.isActive, true)),
          sql`${salaryMonths.id} is not null`,
        ),
      ),
    )
    .orderBy(desc(staff.isActive), asc(staff.name));
  return rows.map(({ employee, entry, upTo, inMonth, taken: done }) => {
    const advanceOwed = owed(upTo, done);
    const pay = entry ? payFor(entry, month, advanceOwed) : null;
    return { employee, entry, pay, advanceOwed, advanceInMonth: inMonth ?? 0 };
  });
}

export async function getEmployee(id: number) {
  const db = await getDb();
  const [row] = await db.select().from(staff).where(eq(staff.id, id));
  return row ?? null;
}

/** Active drivers not on salary yet (added in Settings → Drivers), to put on payroll. */
export async function driversOffPayroll() {
  const db = await getDb();
  return db
    .select({ id: staff.id, name: staff.name, phone: staff.phone })
    .from(staff)
    .where(and(eq(staff.role, "driver"), eq(staff.onPayroll, false), eq(staff.isActive, true)))
    .orderBy(asc(staff.name));
}

export async function getSalaryEntry(staffId: number, month: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(salaryMonths)
    .where(and(eq(salaryMonths.staffId, staffId), eq(salaryMonths.month, month)));
  return row ?? null;
}

/** One person's advances in a month, newest first (the khata on their salary page). */
export async function advancesInMonth(staffId: number, month: string) {
  const db = await getDb();
  const { from, to } = monthRange(month);
  return db
    .select()
    .from(staffAdvances)
    .where(
      and(
        eq(staffAdvances.staffId, staffId),
        gte(staffAdvances.givenOn, from),
        lte(staffAdvances.givenOn, to),
      ),
    )
    .orderBy(desc(staffAdvances.givenOn), desc(staffAdvances.id))
    .limit(200);
}

/** Advances given on one day across everyone (the quick-entry screen), newest first. */
export async function advancesOnDay(day: string) {
  const db = await getDb();
  return db
    .select({ advance: staffAdvances, name: staff.name })
    .from(staffAdvances)
    .innerJoin(staff, eq(staff.id, staffAdvances.staffId))
    .where(eq(staffAdvances.givenOn, day))
    .orderBy(desc(staffAdvances.id))
    .limit(200);
}

/** Everyone an advance can go to: active staff on payroll. */
export async function payrollStaff() {
  const db = await getDb();
  return db
    .select({ id: staff.id, name: staff.name, role: staff.role })
    .from(staff)
    .where(and(eq(staff.onPayroll, true), eq(staff.isActive, true)))
    .orderBy(asc(staff.name));
}

/** Advance owed by one person at a month's end, and how much of it was given that month. */
export async function getAdvanceOwed(staffId: number, month: string) {
  return advanceOwedFor(await getDb(), staffId, month);
}
