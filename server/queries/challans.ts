import "server-only";

import { aliasedTable, and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { collectState } from "@/lib/ledger";
import { getDb } from "@/server/db";
import { challans, payments, trips, trucks, vendors } from "@/server/db/schema";
import { orZero, sumInt } from "@/server/queries/sql";

async function challanQuery() {
  const db = await getDb();
  const sender = aliasedTable(vendors, "sender");
  const receiver = aliasedTable(vendors, "receiver");
  const received = db
    .select({ challanId: payments.challanId, amount: sumInt(payments.amount).as("amount") })
    .from(payments)
    .where(eq(payments.isCancelled, false))
    .groupBy(payments.challanId)
    .as("received");
  const query = db
    .select({
      id: challans.id,
      no: challans.no,
      bookedOn: challans.bookedOn,
      fromPlace: challans.fromPlace,
      toPlace: challans.toPlace,
      packages: challans.packages,
      total: challans.total,
      payType: challans.payType,
      status: challans.status,
      isCancelled: challans.isCancelled,
      senderName: sender.name,
      receiverName: receiver.name,
      truckNumber: trucks.number,
      received: orZero(received.amount),
    })
    .from(challans)
    .innerJoin(sender, eq(sender.id, challans.senderId))
    .innerJoin(receiver, eq(receiver.id, challans.receiverId))
    .leftJoin(trips, eq(trips.id, challans.tripId))
    .leftJoin(trucks, eq(trucks.id, trips.truckId))
    .leftJoin(received, eq(received.challanId, challans.id));
  return { query, sender, receiver };
}

export type ChallanListRow = Awaited<ReturnType<typeof searchChallans>>[number];

/**
 * Search by challan number ("42", "KDR/0042"), party name, truck number, or a day.
 * Newest first, 60 at a time: the list is for finding one, not for reading them all.
 */
export async function searchChallans(opts: { q?: string; day?: string }) {
  const { query, sender, receiver } = await challanQuery();
  const q = opts.q?.trim() ?? "";
  const filters: (SQL | undefined)[] = [];
  if (q) {
    const digits = /(\d+)\s*$/.exec(q)?.[1];
    const like = `%${q}%`;
    filters.push(
      or(
        digits ? eq(challans.no, Number(digits)) : undefined,
        ilike(sender.name, like),
        ilike(receiver.name, like),
        ilike(sql`replace(${trucks.number}, ' ', '')`, `%${q.replace(/\s/g, "")}%`),
      ),
    );
  }
  if (opts.day) filters.push(eq(challans.bookedOn, opts.day));
  const rows = await query
    .where(and(...filters))
    .orderBy(desc(challans.bookedOn), desc(challans.no))
    .limit(60);
  return rows.map((r) => ({ ...r, state: collectState(r.total, r.received, r.payType) }));
}

/** One challan with everything the detail and print views show. */
export async function getChallan(id: number) {
  const db = await getDb();
  const sender = aliasedTable(vendors, "sender");
  const receiver = aliasedTable(vendors, "receiver");
  const [[row], linked] = await Promise.all([
    db
      .select({
        challan: challans,
        sender: {
          id: sender.id,
          name: sender.name,
          phone: sender.phone,
          address: sender.address,
          gstin: sender.gstin,
        },
        receiver: {
          id: receiver.id,
          name: receiver.name,
          phone: receiver.phone,
          address: receiver.address,
          gstin: receiver.gstin,
        },
        trip: {
          id: trips.id,
          toPlace: trips.toPlace,
          departOn: trips.departOn,
          status: trips.status,
        },
        truckNumber: trucks.number,
      })
      .from(challans)
      .innerJoin(sender, eq(sender.id, challans.senderId))
      .innerJoin(receiver, eq(receiver.id, challans.receiverId))
      .leftJoin(trips, eq(trips.id, challans.tripId))
      .leftJoin(trucks, eq(trucks.id, trips.truckId))
      .where(eq(challans.id, id)),
    db
      .select({
        id: payments.id,
        amount: payments.amount,
        mode: payments.mode,
        paidOn: payments.paidOn,
      })
      .from(payments)
      .where(and(eq(payments.challanId, id), eq(payments.isCancelled, false)))
      .orderBy(asc(payments.paidOn)),
  ]);
  if (!row) return null;
  const received = linked.reduce((s, p) => s + p.amount, 0);
  const c = row.challan;
  return {
    ...row,
    payments: linked,
    received,
    due: c.isCancelled ? 0 : Math.max(0, c.total - received),
    state: collectState(c.total, received, c.payType),
  };
}

/** Places typed before, most used first, so the admin picks instead of typing. */
export async function placeOptions(): Promise<string[]> {
  const db = await getDb();
  const count = sql<number>`count(*)`.mapWith(Number);
  // Query builder per column (db.execute's result shape differs between drivers).
  const lists = await Promise.all([
    db.select({ place: challans.fromPlace, n: count }).from(challans).groupBy(challans.fromPlace),
    db.select({ place: challans.toPlace, n: count }).from(challans).groupBy(challans.toPlace),
    db.select({ place: trips.fromPlace, n: count }).from(trips).groupBy(trips.fromPlace),
    db.select({ place: trips.toPlace, n: count }).from(trips).groupBy(trips.toPlace),
  ]);
  const uses = new Map<string, number>([
    ["Kadodara", 0],
    ["Delhi", 0],
    ["Baroda", 0],
  ]);
  for (const list of lists) for (const r of list) uses.set(r.place, (uses.get(r.place) ?? 0) + r.n);
  return [...uses.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([place]) => place);
}

/** Open challans of a party (something still due), for linking a payment. */
export async function openChallansFor(partyId: number) {
  const { query } = await challanQuery();
  const rows = await query
    .where(and(eq(challans.partyId, partyId), eq(challans.isCancelled, false)))
    .orderBy(asc(challans.bookedOn))
    .limit(100);
  return rows.filter((r) => r.received < r.total).map((r) => ({ ...r, due: r.total - r.received }));
}
