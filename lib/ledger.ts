import type { CollectState, PayType } from "@/lib/types";

export type LedgerEntry = {
  key: string;
  day: string;
  kind: "opening" | "challan" | "payment";
  label: string;
  /** Freight charged to the vendor (paise). */
  debit: number;
  /** Money received from the vendor (paise). */
  credit: number;
  href?: string;
};

export type LedgerRow = LedgerEntry & { balance: number };

/**
 * Date order with a running balance (positive = the vendor owes us). Same-day rows keep
 * challans before payments so the balance never dips below zero on the day it is settled.
 * One sort, one pass: O(n log n).
 */
export function buildLedger(entries: readonly LedgerEntry[]): LedgerRow[] {
  const order = { opening: 0, challan: 1, payment: 2 } as const;
  const sorted = [...entries].sort(
    (a, b) => a.day.localeCompare(b.day) || order[a.kind] - order[b.kind],
  );
  let balance = 0;
  return sorted.map((entry) => {
    balance += entry.debit - entry.credit;
    return { ...entry, balance };
  });
}

/** How collection stands on one challan, from what has been received against it. */
export function collectState(total: number, received: number, payType: PayType): CollectState {
  if (received >= total) return "settled";
  if (received > 0) return "part";
  return payType === "billed" ? "credit" : "pending";
}

/**
 * First-in, first-out: money received pays off the oldest charges first. Returns the day of the
 * oldest charge not fully covered, or null when everything is paid. `charges` sorted by day.
 */
export function oldestUnpaidDay(
  charges: readonly { day: string; amount: number }[],
  totalReceived: number,
): string | null {
  let left = totalReceived;
  for (const charge of charges) {
    if (left < charge.amount) return charge.day;
    left -= charge.amount;
  }
  return null;
}
