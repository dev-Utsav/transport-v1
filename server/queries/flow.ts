import "server-only";

import { aliasedTable, and, asc, eq, isNull, ne, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import { challans, drivers, trips, trucks, vendors } from "@/server/db/schema";
import { countInt, sumInt } from "@/server/queries/sql";
import { listVendorBalances } from "@/server/queries/vendors";

const live = eq(challans.isCancelled, false);
const waiting = and(live, isNull(challans.tripId), eq(challans.status, "booked"));

/** Numbers for the five steps on the work board, in one parallel batch. */
export async function flowCounts(today: string) {
  const db = await getDb();
  const [[booked], [wait], byStatus, firstLoading, dues] = await Promise.all([
    db
      .select({ n: countInt() })
      .from(challans)
      .where(and(live, eq(challans.bookedOn, today))),
    db
      .select({ n: countInt(), packages: sumInt(challans.packages) })
      .from(challans)
      .where(waiting),
    db
      .select({ status: trips.status, n: countInt() })
      .from(trips)
      .where(ne(trips.status, "closed"))
      .groupBy(trips.status),
    db
      .select({ id: trips.id })
      .from(trips)
      .where(eq(trips.status, "loading"))
      .orderBy(asc(trips.departOn))
      .limit(1),
    listVendorBalances({ dueOnly: true }),
  ]);
  const trucksIn = (s: string) => byStatus.find((r) => r.status === s)?.n ?? 0;
  return {
    bookedToday: booked?.n ?? 0,
    waiting: wait?.n ?? 0,
    waitingPackages: wait?.packages ?? 0,
    loading: trucksIn("loading"),
    onRoad: trucksIn("in_transit"),
    arrived: trucksIn("arrived"),
    firstLoadingTripId: firstLoading[0]?.id ?? null,
    pending: dues.reduce((s, v) => s + v.balance, 0),
    pendingParties: dues.length,
  };
}

export type WaitingChallan = Awaited<ReturnType<typeof waitingChallans>>[number];

/** Parcels booked and waiting for a truck. */
export async function waitingChallans() {
  const db = await getDb();
  const sender = aliasedTable(vendors, "sender");
  const receiver = aliasedTable(vendors, "receiver");
  return db
    .select({
      id: challans.id,
      no: challans.no,
      bookedOn: challans.bookedOn,
      toPlace: challans.toPlace,
      packages: challans.packages,
      description: challans.description,
      total: challans.total,
      payType: challans.payType,
      senderName: sender.name,
      receiverName: receiver.name,
    })
    .from(challans)
    .innerJoin(sender, eq(sender.id, challans.senderId))
    .innerJoin(receiver, eq(receiver.id, challans.receiverId))
    .where(waiting)
    .orderBy(asc(challans.bookedOn), asc(challans.no))
    .limit(200);
}

/** Trucks that are loading now (where a booked parcel can go). */
export async function loadingTrips() {
  const db = await getDb();
  return db
    .select({ id: trips.id, toPlace: trips.toPlace, truckNumber: trucks.number })
    .from(trips)
    .innerJoin(trucks, eq(trucks.id, trips.truckId))
    .where(eq(trips.status, "loading"))
    .orderBy(asc(trips.departOn));
}

/** What the "Getting started" checklist needs: has each master been set up? */
export async function setupState() {
  const db = await getDb();
  const one = (table: typeof trucks | typeof drivers | typeof vendors) =>
    db
      .select({ n: sql<number>`1`.mapWith(Number) })
      .from(table)
      .limit(1);
  const [t, d, v] = await Promise.all([one(trucks), one(drivers), one(vendors)]);
  return { hasTruck: t.length > 0, hasDriver: d.length > 0, hasParty: v.length > 0 };
}
