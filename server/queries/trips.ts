import "server-only";

import { aliasedTable, and, asc, desc, eq, inArray, ne } from "drizzle-orm";

import { collectState } from "@/lib/ledger";
import type { TripStatus } from "@/lib/types";
import { getDb } from "@/server/db";
import { challans, drivers, expenses, payments, trips, trucks, vendors } from "@/server/db/schema";
import { countInt, orZero, sumInt } from "@/server/queries/sql";

const OPEN: TripStatus[] = ["loading", "in_transit", "arrived"];

async function tripTotalsQuery() {
  const db = await getDb();
  const load = db
    .select({
      tripId: challans.tripId,
      challanCount: countInt().as("challan_count"),
      packages: sumInt(challans.packages).as("packages"),
      freight: sumInt(challans.total).as("freight"),
    })
    .from(challans)
    .where(eq(challans.isCancelled, false))
    .groupBy(challans.tripId)
    .as("load");
  // Wrapped in an object: returning the builder itself from an async function would run it.
  const query = db
    .select({
      id: trips.id,
      fromPlace: trips.fromPlace,
      toPlace: trips.toPlace,
      departOn: trips.departOn,
      expectedOn: trips.expectedOn,
      status: trips.status,
      truckNumber: trucks.number,
      driverName: drivers.name,
      challanCount: orZero(load.challanCount),
      packages: orZero(load.packages),
      freight: orZero(load.freight),
    })
    .from(trips)
    .innerJoin(trucks, eq(trucks.id, trips.truckId))
    .leftJoin(drivers, eq(drivers.id, trips.driverId))
    .leftJoin(load, eq(load.tripId, trips.id));
  return { query };
}

export type TripListRow = Awaited<ReturnType<typeof listTrips>>[number];

/** Open trips (all of them) or closed ones (latest first, capped). */
export async function listTrips(which: "open" | "closed") {
  const { query } = await tripTotalsQuery();
  if (which === "open") {
    return query.where(inArray(trips.status, OPEN)).orderBy(desc(trips.departOn), desc(trips.id));
  }
  return query
    .where(eq(trips.status, "closed"))
    .orderBy(desc(trips.departOn), desc(trips.id))
    .limit(100);
}

/**
 * Trip screen: the trip, every challan on it with parties and what's been received, grouped by
 * the party who pays ("what is on this truck?"), and the trip's expenses. 4 queries in parallel.
 */
export async function getTripDetail(id: number) {
  const db = await getDb();
  const sender = aliasedTable(vendors, "sender");
  const receiver = aliasedTable(vendors, "receiver");
  const party = aliasedTable(vendors, "party");
  const received = db
    .select({ challanId: payments.challanId, amount: sumInt(payments.amount).as("amount") })
    .from(payments)
    .where(eq(payments.isCancelled, false))
    .groupBy(payments.challanId)
    .as("received");

  const [[trip], rows, tripExpenses] = await Promise.all([
    db
      .select({
        id: trips.id,
        fromPlace: trips.fromPlace,
        toPlace: trips.toPlace,
        departOn: trips.departOn,
        expectedOn: trips.expectedOn,
        status: trips.status,
        note: trips.note,
        truckId: trips.truckId,
        driverId: trips.driverId,
        truckNumber: trucks.number,
        truckType: trucks.type,
        truckOwner: trucks.owner,
        driverName: drivers.name,
        driverPhone: drivers.phone,
      })
      .from(trips)
      .innerJoin(trucks, eq(trucks.id, trips.truckId))
      .leftJoin(drivers, eq(drivers.id, trips.driverId))
      .where(eq(trips.id, id)),
    db
      .select({
        id: challans.id,
        no: challans.no,
        packages: challans.packages,
        description: challans.description,
        total: challans.total,
        payType: challans.payType,
        status: challans.status,
        toPlace: challans.toPlace,
        senderName: sender.name,
        receiverName: receiver.name,
        partyId: challans.partyId,
        partyName: party.name,
        partyPhone: party.phone,
        received: orZero(received.amount),
      })
      .from(challans)
      .innerJoin(sender, eq(sender.id, challans.senderId))
      .innerJoin(receiver, eq(receiver.id, challans.receiverId))
      .innerJoin(party, eq(party.id, challans.partyId))
      .leftJoin(received, eq(received.challanId, challans.id))
      .where(and(eq(challans.tripId, id), eq(challans.isCancelled, false)))
      .orderBy(asc(challans.no)),
    db
      .select({
        id: expenses.id,
        day: expenses.spentOn,
        amount: expenses.amount,
        category: expenses.category,
      })
      .from(expenses)
      .where(and(eq(expenses.tripId, id), eq(expenses.isCancelled, false)))
      .orderBy(asc(expenses.spentOn)),
  ]);
  if (!trip) return null;

  type Row = (typeof rows)[number] & { due: number; state: ReturnType<typeof collectState> };
  const groups = new Map<
    number,
    {
      partyId: number;
      name: string;
      phone: string;
      packages: number;
      freight: number;
      due: number;
      challans: Row[];
    }
  >();
  let packages = 0;
  let freight = 0;
  let due = 0;
  let undelivered = 0;
  for (const r of rows) {
    const rowDue = Math.max(0, r.total - r.received);
    const row: Row = { ...r, due: rowDue, state: collectState(r.total, r.received, r.payType) };
    const g = groups.get(r.partyId) ?? {
      partyId: r.partyId,
      name: r.partyName,
      phone: r.partyPhone,
      packages: 0,
      freight: 0,
      due: 0,
      challans: [],
    };
    g.packages += r.packages;
    g.freight += r.total;
    g.due += rowDue;
    g.challans.push(row);
    groups.set(r.partyId, g);
    packages += r.packages;
    freight += r.total;
    due += rowDue;
    if (r.status !== "delivered") undelivered += 1;
  }
  const spent = tripExpenses.reduce((s, e) => s + e.amount, 0);
  return {
    trip,
    groups: [...groups.values()].sort((a, b) => b.freight - a.freight),
    totals: {
      packages,
      freight,
      due,
      spent,
      profit: freight - spent,
      challans: rows.length,
      undelivered,
    },
    expenses: tripExpenses,
  };
}

export async function getTrip(id: number) {
  const db = await getDb();
  const [row] = await db.select().from(trips).where(eq(trips.id, id));
  return row ?? null;
}

/** Trips that can still take challans or expenses, for pickers. */
export async function tripOptions() {
  const db = await getDb();
  return db
    .select({
      id: trips.id,
      truckNumber: trucks.number,
      toPlace: trips.toPlace,
      departOn: trips.departOn,
      status: trips.status,
    })
    .from(trips)
    .innerJoin(trucks, eq(trucks.id, trips.truckId))
    .where(ne(trips.status, "closed"))
    .orderBy(desc(trips.departOn), desc(trips.id))
    .limit(50);
}

export async function truckOptions(includeInactive = false) {
  const db = await getDb();
  return db
    .select()
    .from(trucks)
    .where(includeInactive ? undefined : eq(trucks.isActive, true))
    .orderBy(desc(trucks.isActive), asc(trucks.number));
}

export async function driverOptions(includeInactive = false) {
  const db = await getDb();
  return db
    .select()
    .from(drivers)
    .where(includeInactive ? undefined : eq(drivers.isActive, true))
    .orderBy(desc(drivers.isActive), asc(drivers.name));
}
