import "server-only";

import { and, asc, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";

import { formatChallanNo } from "@/lib/challan-no";

import { buildLedger, oldestUnpaidDay } from "@/lib/ledger";
import type { LedgerEntry } from "@/lib/ledger";
import { getDb } from "@/server/db";
import { challans, payments, vendors } from "@/server/db/schema";
import { orZero, sumInt } from "@/server/queries/sql";

async function balanceQuery() {
  const db = await getDb();
  const charged = db
    .select({ partyId: challans.partyId, business: sumInt(challans.total).as("business") })
    .from(challans)
    .where(eq(challans.isCancelled, false))
    .groupBy(challans.partyId)
    .as("charged");
  const paid = db
    .select({ vendorId: payments.vendorId, received: sumInt(payments.amount).as("received") })
    .from(payments)
    .where(eq(payments.isCancelled, false))
    .groupBy(payments.vendorId)
    .as("paid");
  const business = orZero(charged.business);
  const received = orZero(paid.received);
  const balance = sql<number>`${vendors.openingBalance} + ${business} - ${received}`.mapWith(
    Number,
  );
  const query = db
    .select({
      id: vendors.id,
      name: vendors.name,
      phone: vendors.phone,
      kind: vendors.kind,
      isActive: vendors.isActive,
      openingBalance: vendors.openingBalance,
      business,
      received,
      balance,
    })
    .from(vendors)
    .leftJoin(charged, eq(charged.partyId, vendors.id))
    .leftJoin(paid, eq(paid.vendorId, vendors.id));
  return { query, balance };
}

export type VendorBalance = Awaited<ReturnType<typeof listVendorBalances>>[number];

/** Every party with totals, biggest balance first. One query, aggregates in SQL. */
export async function listVendorBalances(opts: { q?: string; dueOnly?: boolean } = {}) {
  const { query, balance } = await balanceQuery();
  const q = opts.q?.trim();
  const filters = [
    q ? or(ilike(vendors.name, `%${q}%`), ilike(vendors.phone, `%${q}%`)) : undefined,
    opts.dueOnly ? gt(balance, 0) : undefined,
  ];
  return query
    .where(and(...filters))
    .orderBy(desc(vendors.isActive), desc(balance), asc(vendors.name))
    .limit(300);
}

export async function getVendorBalance(id: number) {
  const { query } = await balanceQuery();
  const [row] = await query.where(eq(vendors.id, id));
  return row ?? null;
}

export async function getVendor(id: number) {
  const db = await getDb();
  const [row] = await db.select().from(vendors).where(eq(vendors.id, id));
  return row ?? null;
}

/** Total still to collect across all parties (only positive balances count). */
export async function totalPending(): Promise<number> {
  const rows = await listVendorBalances({ dueOnly: true });
  return rows.reduce((sum, r) => sum + r.balance, 0);
}

/** Ledger: opening, every challan charged and every payment, date order, running balance. */
export async function vendorLedger(id: number, prefix: string) {
  const db = await getDb();
  const [vendor, charged, paid] = await Promise.all([
    getVendor(id),
    db
      .select({
        id: challans.id,
        no: challans.no,
        day: challans.bookedOn,
        total: challans.total,
        to: challans.toPlace,
      })
      .from(challans)
      .where(and(eq(challans.partyId, id), eq(challans.isCancelled, false))),
    db
      .select({
        id: payments.id,
        day: payments.paidOn,
        amount: payments.amount,
        mode: payments.mode,
        note: payments.note,
      })
      .from(payments)
      .where(and(eq(payments.vendorId, id), eq(payments.isCancelled, false))),
  ]);
  if (!vendor) return null;
  const entries: LedgerEntry[] = [];
  if (vendor.openingBalance !== 0) {
    entries.push({
      key: "opening",
      // Empty day sorts before every real date: the old balance always comes first.
      day: "",
      kind: "opening",
      label: "",
      debit: Math.max(0, vendor.openingBalance),
      credit: Math.max(0, -vendor.openingBalance),
    });
  }
  for (const c of charged) {
    entries.push({
      key: `c${c.id}`,
      day: c.day,
      kind: "challan",
      label: `${formatChallanNo(c.no, prefix)} · ${c.to}`,
      debit: c.total,
      credit: 0,
      href: `/challans/${c.id}`,
    });
  }
  for (const p of paid) {
    entries.push({
      key: `p${p.id}`,
      day: p.day,
      kind: "payment",
      label: p.mode,
      debit: 0,
      credit: p.amount,
    });
  }
  return { vendor, rows: buildLedger(entries) };
}

/** Parties whose oldest unpaid charge (FIFO) is older than the cutoff day. */
export async function overdueVendors(cutoffDay: string) {
  const db = await getDb();
  const due = await listVendorBalances({ dueOnly: true });
  if (due.length === 0) return [];
  const ids = due.map((v) => v.id);
  const charges = await db
    .select({ partyId: challans.partyId, day: challans.bookedOn, amount: challans.total })
    .from(challans)
    .where(and(eq(challans.isCancelled, false), inArray(challans.partyId, ids)))
    .orderBy(asc(challans.bookedOn), asc(challans.id));

  const byParty = new Map<number, { day: string; amount: number }[]>();
  for (const c of charges) {
    const list = byParty.get(c.partyId) ?? [];
    list.push({ day: c.day, amount: c.amount });
    byParty.set(c.partyId, list);
  }
  return due
    .map((v) => {
      // Opening balance is the oldest charge of all.
      const list = byParty.get(v.id) ?? [];
      const all =
        v.openingBalance > 0 ? [{ day: "0000-00-00", amount: v.openingBalance }, ...list] : list;
      return { ...v, oldestDue: oldestUnpaidDay(all, v.received) };
    })
    .filter((v) => v.oldestDue !== null && v.oldestDue <= cutoffDay)
    .sort((a, b) => b.balance - a.balance);
}

/** For pickers: active parties, A–Z. */
export async function vendorOptions() {
  const db = await getDb();
  return db
    .select({ id: vendors.id, name: vendors.name, kind: vendors.kind, phone: vendors.phone })
    .from(vendors)
    .where(eq(vendors.isActive, true))
    .orderBy(asc(vendors.name));
}
