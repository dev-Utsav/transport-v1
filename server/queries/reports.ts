import "server-only";

import { and, between, desc, eq, gt, lt, sql } from "drizzle-orm";

import { monthRange } from "@/lib/dates";
import { getDb } from "@/server/db";
import {
  challans,
  expenses,
  payments,
  salaryMonths,
  employees,
  trips,
  trucks,
  vendors,
} from "@/server/db/schema";
import { countInt, orZero, sumInt } from "@/server/queries/sql";
import { getSettings } from "@/server/settings";

/** Cash book for one day: opening (everything in cash before it), cash in, cash out, closing. */
export async function cashBook(day: string) {
  const db = await getDb();
  const settings = await getSettings();
  const cashPay = and(eq(payments.mode, "cash"), eq(payments.isCancelled, false));
  const cashExp = and(eq(expenses.mode, "cash"), eq(expenses.isCancelled, false));
  const cashSal = eq(salaryMonths.paidMode, "cash");
  const [[inBefore], [outBefore], [salBefore], ins, outs, sals] = await Promise.all([
    db
      .select({ v: sumInt(payments.amount) })
      .from(payments)
      .where(and(cashPay, lt(payments.paidOn, day))),
    db
      .select({ v: sumInt(expenses.amount) })
      .from(expenses)
      .where(and(cashExp, lt(expenses.spentOn, day))),
    db
      .select({ v: sumInt(salaryMonths.paidAmount) })
      .from(salaryMonths)
      .where(and(cashSal, lt(salaryMonths.paidOn, day))),
    db
      .select({ id: payments.id, amount: payments.amount, name: vendors.name, note: payments.note })
      .from(payments)
      .innerJoin(vendors, eq(vendors.id, payments.vendorId))
      .where(and(cashPay, eq(payments.paidOn, day)))
      .orderBy(payments.id),
    db
      .select({
        id: expenses.id,
        amount: expenses.amount,
        category: expenses.category,
        note: expenses.note,
      })
      .from(expenses)
      .where(and(cashExp, eq(expenses.spentOn, day)))
      .orderBy(expenses.id),
    db
      .select({
        id: salaryMonths.id,
        amount: orZero(salaryMonths.paidAmount),
        name: employees.name,
      })
      .from(salaryMonths)
      .innerJoin(employees, eq(employees.id, salaryMonths.employeeId))
      .where(and(cashSal, eq(salaryMonths.paidOn, day))),
  ]);
  const opening =
    settings.openingCash + (inBefore?.v ?? 0) - (outBefore?.v ?? 0) - (salBefore?.v ?? 0);
  const cashIn = ins.reduce((s, r) => s + r.amount, 0);
  const cashOut = outs.reduce((s, r) => s + r.amount, 0) + sals.reduce((s, r) => s + r.amount, 0);
  return { opening, cashIn, cashOut, closing: opening + cashIn - cashOut, ins, outs, sals };
}

/** Trips that left in the month: freight on the truck minus expenses tied to the trip. */
export async function tripProfit(month: string) {
  const db = await getDb();
  const { from, to } = monthRange(month);
  const load = db
    .select({ tripId: challans.tripId, freight: sumInt(challans.total).as("freight") })
    .from(challans)
    .where(eq(challans.isCancelled, false))
    .groupBy(challans.tripId)
    .as("load");
  const spend = db
    .select({ tripId: expenses.tripId, spent: sumInt(expenses.amount).as("spent") })
    .from(expenses)
    .where(eq(expenses.isCancelled, false))
    .groupBy(expenses.tripId)
    .as("spend");
  const freight = orZero(load.freight);
  const spent = orZero(spend.spent);
  return db
    .select({
      id: trips.id,
      departOn: trips.departOn,
      fromPlace: trips.fromPlace,
      toPlace: trips.toPlace,
      status: trips.status,
      truckNumber: trucks.number,
      freight,
      spent,
      profit: sql<number>`${freight} - ${spent}`.mapWith(Number),
    })
    .from(trips)
    .innerJoin(trucks, eq(trucks.id, trips.truckId))
    .leftJoin(load, eq(load.tripId, trips.id))
    .leftJoin(spend, eq(spend.tripId, trips.id))
    .where(between(trips.departOn, from, to))
    .orderBy(desc(trips.departOn));
}

/** Challans with GST in the month: totals, split by rate, and the rows for the CA. */
export async function gstSummary(month: string) {
  const db = await getDb();
  const { from, to } = monthRange(month);
  const where = and(
    between(challans.bookedOn, from, to),
    eq(challans.isCancelled, false),
    gt(challans.gstAmount, 0),
  );
  const [byRate, rows] = await Promise.all([
    db
      .select({
        rateBp: challans.gstRateBp,
        count: countInt(),
        taxable: sumInt(challans.taxable),
        tax: sumInt(challans.gstAmount),
      })
      .from(challans)
      .where(where)
      .groupBy(challans.gstRateBp)
      .orderBy(challans.gstRateBp),
    db
      .select({
        no: challans.no,
        bookedOn: challans.bookedOn,
        partyName: vendors.name,
        partyGstin: vendors.gstin,
        rateBp: challans.gstRateBp,
        taxable: challans.taxable,
        tax: challans.gstAmount,
        total: challans.total,
      })
      .from(challans)
      .innerJoin(vendors, eq(vendors.id, challans.partyId))
      .where(where)
      .orderBy(challans.bookedOn, challans.no),
  ]);
  const totals = byRate.reduce(
    (t, r) => ({ count: t.count + r.count, taxable: t.taxable + r.taxable, tax: t.tax + r.tax }),
    { count: 0, taxable: 0, tax: 0 },
  );
  return { byRate, rows, totals };
}
