import type { GstMode } from "@/lib/types";

export type GstBreakup = { taxable: number; gstAmount: number; total: number };

/**
 * Splits a freight amount (paise) into taxable value, GST and total.
 * - none: no GST on this challan.
 * - excluded: GST is added on top of the freight.
 * - included: the freight already contains GST; the taxable part is backed out.
 * Rates are basis points (5% = 500). GST is rounded to the nearest paisa once, and the
 * taxable value is derived from it, so taxable + GST always equals the total exactly.
 */
export function splitGst(freight: number, mode: GstMode, rateBp: number): GstBreakup {
  if (mode === "none" || rateBp <= 0) return { taxable: freight, gstAmount: 0, total: freight };
  if (mode === "excluded") {
    const gstAmount = Math.round((freight * rateBp) / 10_000);
    return { taxable: freight, gstAmount, total: freight + gstAmount };
  }
  const gstAmount = Math.round((freight * rateBp) / (10_000 + rateBp));
  return { taxable: freight - gstAmount, gstAmount, total: freight };
}

/** "5" or "12.5" typed by the admin → basis points. Null when out of range. */
export function parseRate(input: string): number | null {
  const n = Number(input.trim());
  if (!Number.isFinite(n) || n < 0 || n > 28) return null;
  return Math.round(n * 100);
}

export function formatRate(rateBp: number): string {
  return `${rateBp / 100}%`;
}
