import "server-only";

import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";

import { monthRange, shiftMonth } from "@/lib/dates";
import { oldestUnpaidDay } from "@/lib/ledger";
import { daysBetween, deliveryScore, partyScore } from "@/lib/score";
import { getDb } from "@/server/db";
import {
  challans,
  expenses,
  payments,
  salaryMonths,
  staff,
  staffAdvances,
  trips,
  trucks,
  vendors,
} from "@/server/db/schema";
import { orZero, sumInt } from "@/server/queries/sql";

/* ---------- Parties (customers) ---------- */

/**
 * Every party with business or a balance: billed and received since `from`, what they owe now,
 * how old their oldest unpaid charge is (FIFO), and the score. Two round trips: the totals in one
 * query, then the unpaid parties' charges to date their oldest due.
 */
export async function partyScorecard(from: string, today: string) {
  const db = await getDb();
  const charged = db
    .select({
      partyId: challans.partyId,
      all: sumInt(challans.total).as("all_billed"),
      win: sql<number>`coalesce(sum(${challans.total}) filter (where ${challans.bookedOn} >= ${from}), 0)`
        .mapWith(Number)
        .as("win_billed"),
    })
    .from(challans)
    .where(eq(challans.isCancelled, false))
    .groupBy(challans.partyId)
    .as("charged");
  const paid = db
    .select({
      vendorId: payments.vendorId,
      all: sumInt(payments.amount).as("all_received"),
      win: sql<number>`coalesce(sum(${payments.amount}) filter (where ${payments.paidOn} >= ${from}), 0)`
        .mapWith(Number)
        .as("win_received"),
    })
    .from(payments)
    .where(eq(payments.isCancelled, false))
    .groupBy(payments.vendorId)
    .as("paid");
  const rows = await db
    .select({
      id: vendors.id,
      name: vendors.name,
      phone: vendors.phone,
      openingBalance: vendors.openingBalance,
      billed: orZero(charged.win),
      received: orZero(paid.win),
      allReceived: orZero(paid.all),
      balance: sql<number>`${vendors.openingBalance} + ${orZero(charged.all)} - ${orZero(paid.all)}`.mapWith(
        Number,
      ),
    })
    .from(vendors)
    .leftJoin(charged, eq(charged.partyId, vendors.id))
    .leftJoin(paid, eq(paid.vendorId, vendors.id))
    .where(eq(vendors.isActive, true))
    .limit(500);
  const active = rows.filter((r) => r.billed > 0 || r.received > 0 || r.balance > 0);
  const dueIds = active.filter((r) => r.balance > 0).map((r) => r.id);
  const charges = dueIds.length
    ? await db
        .select({ partyId: challans.partyId, day: challans.bookedOn, amount: challans.total })
        .from(challans)
        .where(and(eq(challans.isCancelled, false), inArray(challans.partyId, dueIds)))
        .orderBy(asc(challans.bookedOn), asc(challans.id))
    : [];
  const byParty = new Map<number, { day: string; amount: number }[]>();
  for (const c of charges) {
    const list = byParty.get(c.partyId) ?? [];
    list.push({ day: c.day, amount: c.amount });
    byParty.set(c.partyId, list);
  }
  const topBilled = Math.max(0, ...active.map((r) => r.billed));
  return active
    .map((r) => {
      let oldestDueDays: number | null = null;
      if (r.balance > 0) {
        const list = byParty.get(r.id) ?? [];
        // The opening balance is the oldest charge of all: count it from the window's start.
        const all = r.openingBalance > 0 ? [{ day: from, amount: r.openingBalance }, ...list] : list;
        const day = oldestUnpaidDay(all, r.allReceived);
        oldestDueDays = day ? Math.max(0, daysBetween(day, today)) : null;
      }
      const figures = { billed: r.billed, received: r.received, balance: r.balance, oldestDueDays };
      return { ...r, oldestDueDays, ...partyScore(figures, topBilled) };
    })
    .sort((a, b) => b.score - a.score || b.billed - a.billed);
}

/* ---------- Trips: drivers, hired truck owners, trucks ---------- */

type Tally = {
  key: string;
  name: string;
  trips: number;
  measured: number;
  onTime: number;
  lateDays: number;
  freight: number;
  spent: number;
};

function tally(map: Map<string, Tally>, key: string, name: string) {
  let t = map.get(key);
  if (!t) {
    t = { key, name, trips: 0, measured: 0, onTime: 0, lateDays: 0, freight: 0, spent: 0 };
    map.set(key, t);
  }
  return t;
}

function scored(map: Map<string, Tally>) {
  const list = [...map.values()];
  const topTrips = Math.max(0, ...list.map((t) => t.trips));
  return list
    .map((t) => {
      const late = t.measured - t.onTime;
      return {
        ...t,
        profit: t.freight - t.spent,
        avgLateDays: late > 0 ? t.lateDays / late : 0,
        result: deliveryScore(t, topTrips),
      };
    })
    .sort(
      (a, b) =>
        (b.result?.score ?? -1) - (a.result?.score ?? -1) || b.trips - a.trips || b.profit - a.profit,
    );
}

/**
 * Trips that left since `from`, read once and grouped in one pass: per driver, per hired truck
 * owner (trucks marked hired, grouped by owner name) and per truck. On time = arrived on or
 * before the expected day; trips without an expected day or not arrived yet aren't measured.
 */
export async function tripScorecards(from: string) {
  const db = await getDb();
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
  const rows = await db
    .select({
      truckId: trucks.id,
      truckNumber: trucks.number,
      owner: trucks.owner,
      ownerName: trucks.ownerName,
      driverId: trips.driverId,
      driverName: staff.name,
      expectedOn: trips.expectedOn,
      arrivedOn: trips.arrivedOn,
      freight: orZero(load.freight),
      spent: orZero(spend.spent),
    })
    .from(trips)
    .innerJoin(trucks, eq(trucks.id, trips.truckId))
    .leftJoin(staff, eq(staff.id, trips.driverId))
    .leftJoin(load, eq(load.tripId, trips.id))
    .leftJoin(spend, eq(spend.tripId, trips.id))
    .where(gte(trips.departOn, from))
    .orderBy(desc(trips.departOn))
    .limit(3000);

  const drivers = new Map<string, Tally>();
  const owners = new Map<string, Tally>();
  const fleet = new Map<string, Tally>();
  for (const r of rows) {
    const groups = [tally(fleet, String(r.truckId), r.truckNumber)];
    if (r.driverId && r.driverName) groups.push(tally(drivers, String(r.driverId), r.driverName));
    if (r.owner === "hired") {
      const name = r.ownerName.trim() || r.truckNumber;
      groups.push(tally(owners, name.toLowerCase(), name));
    }
    const measured = r.expectedOn !== null && r.arrivedOn !== null;
    const late = measured && r.arrivedOn && r.expectedOn ? daysBetween(r.expectedOn, r.arrivedOn) : 0;
    for (const t of groups) {
      t.trips += 1;
      t.freight += r.freight;
      t.spent += r.spent;
      if (measured) {
        t.measured += 1;
        if (late <= 0) t.onTime += 1;
        else t.lateDays += late;
      }
    }
  }
  return {
    drivers: scored(drivers),
    owners: scored(owners),
    trucks: [...fleet.values()]
      .map((t) => ({ ...t, profit: t.freight - t.spent }))
      .sort((a, b) => b.profit - a.profit),
  };
}

/* ---------- Money in and out ---------- */

const monthOf = (column: AnyColumn) => sql<string>`to_char(${column}, 'YYYY-MM')`;

/**
 * Where the money went in a month, and in vs out for the six months up to it. Out = expenses +
 * salaries paid + advances given (salary is paid net of advances, so nothing counts twice).
 */
export async function moneyOverview(month: string) {
  const db = await getDb();
  const { from, to } = monthRange(month);
  const trendFrom = monthRange(shiftMonth(month, -5)).from;
  const live = {
    pay: eq(payments.isCancelled, false),
    exp: eq(expenses.isCancelled, false),
    adv: eq(staffAdvances.isCancelled, false),
  };
  const [booked, inByMode, byCategory, salaryPaid, advances, trendIn, trendExp, trendSal, trendAdv] =
    await Promise.all([
      db
        .select({ v: sumInt(challans.total) })
        .from(challans)
        .where(
          and(
            eq(challans.isCancelled, false),
            gte(challans.bookedOn, from),
            lte(challans.bookedOn, to),
          ),
        ),
      db
        .select({ mode: payments.mode, v: sumInt(payments.amount) })
        .from(payments)
        .where(and(live.pay, gte(payments.paidOn, from), lte(payments.paidOn, to)))
        .groupBy(payments.mode),
      db
        .select({ category: expenses.category, v: sumInt(expenses.amount) })
        .from(expenses)
        .where(and(live.exp, gte(expenses.spentOn, from), lte(expenses.spentOn, to)))
        .groupBy(expenses.category)
        .orderBy(desc(sumInt(expenses.amount))),
      db
        .select({ v: sumInt(salaryMonths.paidAmount) })
        .from(salaryMonths)
        .where(and(gte(salaryMonths.paidOn, from), lte(salaryMonths.paidOn, to))),
      db
        .select({ v: sumInt(staffAdvances.amount) })
        .from(staffAdvances)
        .where(and(live.adv, gte(staffAdvances.givenOn, from), lte(staffAdvances.givenOn, to))),
      byMonth(db, payments.paidOn, payments.amount, live.pay, trendFrom, to),
      byMonth(db, expenses.spentOn, expenses.amount, live.exp, trendFrom, to),
      byMonth(db, salaryMonths.paidOn, salaryMonths.paidAmount, undefined, trendFrom, to),
      byMonth(db, staffAdvances.givenOn, staffAdvances.amount, live.adv, trendFrom, to),
    ]);
  const moneyIn = inByMode.reduce((s, r) => s + r.v, 0);
  const spent = byCategory.reduce((s, r) => s + r.v, 0);
  const salaries = salaryPaid[0]?.v ?? 0;
  const advanced = advances[0]?.v ?? 0;
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5));
  const at = (list: { m: string; v: number }[], m: string) => list.find((r) => r.m === m)?.v ?? 0;
  return {
    booked: booked[0]?.v ?? 0,
    moneyIn,
    inByMode,
    byCategory,
    expenses: spent,
    salaries,
    advances: advanced,
    moneyOut: spent + salaries + advanced,
    trend: months.map((m) => {
      const out = at(trendExp, m) + at(trendSal, m) + at(trendAdv, m);
      return { month: m, in: at(trendIn, m), out };
    }),
  };
}

/** Sum of `amount` per month of `day` between two days (one grouped query). */
function byMonth(
  db: Awaited<ReturnType<typeof getDb>>,
  day: typeof payments.paidOn | typeof expenses.spentOn | typeof salaryMonths.paidOn | typeof staffAdvances.givenOn,
  amount:
    | typeof payments.amount
    | typeof expenses.amount
    | typeof salaryMonths.paidAmount
    | typeof staffAdvances.amount,
  live: ReturnType<typeof eq> | undefined,
  from: string,
  to: string,
) {
  const m = monthOf(day);
  return db
    .select({ m, v: sumInt(amount) })
    .from(day.table)
    .where(and(live, gte(day, from), lte(day, to)))
    .groupBy(m);
}
