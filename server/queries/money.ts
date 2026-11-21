import "server-only";

import { and, between, desc, eq, sql } from "drizzle-orm";

import { monthRange, shiftMonth } from "@/lib/dates";
import type { PayMode } from "@/lib/types";
import { getDb } from "@/server/db";
import { expenses, payments, trips, trucks, vendors } from "@/server/db/schema";
import { sumInt } from "@/server/queries/sql";

/** Dashboard money for one day: collection split by mode, and total spent. */
export async function daySummary(day: string) {
  const db = await getDb();
  const [byMode, [spent]] = await Promise.all([
    db
      .select({ mode: payments.mode, amount: sumInt(payments.amount) })
      .from(payments)
      .where(and(eq(payments.paidOn, day), eq(payments.isCancelled, false)))
      .groupBy(payments.mode),
    db
      .select({ amount: sumInt(expenses.amount) })
      .from(expenses)
      .where(and(eq(expenses.spentOn, day), eq(expenses.isCancelled, false))),
  ]);
  const collected: Record<PayMode, number> = { cash: 0, upi: 0, bank: 0 };
  for (const r of byMode) collected[r.mode] = r.amount;
  return {
    collected,
    collectedTotal: collected.cash + collected.upi + collected.bank,
    spent: spent?.amount ?? 0,
  };
}

export type ExpenseRow = Awaited<ReturnType<typeof listExpenses>>[number];

export async function listExpenses(month: string) {
  const db = await getDb();
  const { from, to } = monthRange(month);
  return db
    .select({
      id: expenses.id,
      spentOn: expenses.spentOn,
      amount: expenses.amount,
      category: expenses.category,
      mode: expenses.mode,
      note: expenses.note,
      hasPhoto: expenses.hasPhoto,
      isCancelled: expenses.isCancelled,
      truckNumber: trucks.number,
      tripTo: trips.toPlace,
    })
    .from(expenses)
    .leftJoin(trucks, eq(trucks.id, expenses.truckId))
    .leftJoin(trips, eq(trips.id, expenses.tripId))
    .where(between(expenses.spentOn, from, to))
    .orderBy(desc(expenses.spentOn), desc(expenses.id));
}

export async function getExpense(id: number) {
  const db = await getDb();
  const [row] = await db.select().from(expenses).where(eq(expenses.id, id));
  return row ?? null;
}

/** Expense totals for a month by category and by truck, plus the last six months. */
export async function expenseBreakdown(month: string) {
  const db = await getDb();
  const { from, to } = monthRange(month);
  const live = and(between(expenses.spentOn, from, to), eq(expenses.isCancelled, false));
  const sixBack = `${shiftMonth(month, -5)}-01`;
  const monthKey = sql<string>`substr(${expenses.spentOn}::text, 1, 7)`;
  const [byCategory, byTruck, byMonth] = await Promise.all([
    db
      .select({ category: expenses.category, amount: sumInt(expenses.amount) })
      .from(expenses)
      .where(live)
      .groupBy(expenses.category)
      .orderBy(desc(sumInt(expenses.amount))),
    db
      .select({ truckNumber: trucks.number, amount: sumInt(expenses.amount) })
      .from(expenses)
      .leftJoin(trucks, eq(trucks.id, expenses.truckId))
      .where(live)
      .groupBy(trucks.number)
      .orderBy(desc(sumInt(expenses.amount))),
    db
      .select({ month: monthKey, amount: sumInt(expenses.amount) })
      .from(expenses)
      .where(and(between(expenses.spentOn, sixBack, to), eq(expenses.isCancelled, false)))
      .groupBy(monthKey)
      .orderBy(monthKey),
  ]);
  // Always six bars, oldest first: months with no spending show as zero, not as a gap.
  const spentIn = new Map(byMonth.map((r) => [r.month, r.amount]));
  const sixMonths = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((m) => ({
    month: m,
    amount: spentIn.get(m) ?? 0,
  }));
  return {
    byCategory,
    byTruck,
    byMonth: sixMonths,
    total: byCategory.reduce((s, r) => s + r.amount, 0),
  };
}

/** Recent payments, for the payment screen's "just recorded" list. */
export async function recentPayments(limit = 8) {
  const db = await getDb();
  return db
    .select({
      id: payments.id,
      amount: payments.amount,
      mode: payments.mode,
      paidOn: payments.paidOn,
      vendorId: payments.vendorId,
      vendorName: vendors.name,
    })
    .from(payments)
    .innerJoin(vendors, eq(vendors.id, payments.vendorId))
    .where(eq(payments.isCancelled, false))
    .orderBy(desc(payments.createdAt))
    .limit(limit);
}

export async function getPayment(id: number) {
  const db = await getDb();
  const [row] = await db.select().from(payments).where(eq(payments.id, id));
  return row ?? null;
}
