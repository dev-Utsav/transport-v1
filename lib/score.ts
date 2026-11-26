/**
 * Scorecards: 0–100, higher is better, with every part shown next to the score so nobody has to
 * trust a black box. The weights are our default, not the client's rule (open point in
 * docs/PROGRESS.md, 2026-11-25); change them here and the screens follow.
 */

export const SCORE_BANDS = ["good", "watch", "poor"] as const;
export type ScoreBand = (typeof SCORE_BANDS)[number];

export function scoreBand(score: number): ScoreBand {
  if (score >= 75) return "good";
  if (score >= 50) return "watch";
  return "poor";
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export type PartyFigures = {
  /** freight charged to them in the window */
  billed: number;
  /** money received from them in the window */
  received: number;
  /** what they owe now (all time) */
  balance: number;
  /** days since their oldest unpaid charge, null when nothing is owed */
  oldestDueDays: number | null;
};

/**
 * A party (customer): do they pay (50), do they pay on time (30), how much business (20).
 * - pays: received ÷ billed in the window (nothing billed and nothing owed counts as full);
 * - on time: full when the oldest unpaid charge is ≤ 15 days old, none at ≥ 60 days;
 * - business: their billing ÷ the biggest party's billing in the window.
 */
export function partyScore(p: PartyFigures, topBilled: number) {
  const pays = p.billed > 0 ? clamp01(p.received / p.billed) : p.balance > 0 ? 0 : 1;
  const onTime = p.oldestDueDays === null ? 1 : clamp01((60 - p.oldestDueDays) / 45);
  const business = topBilled > 0 ? clamp01(p.billed / topBilled) : 0;
  const score = Math.round(50 * pays + 30 * onTime + 20 * business);
  return { score, band: scoreBand(score), pays, onTime, business };
}

export type DeliveryFigures = {
  trips: number;
  /** trips with an expected day that have arrived */
  measured: number;
  /** of those, arrived on or before the expected day */
  onTime: number;
};

/**
 * A driver or a hired truck owner: arrives on time (70) and does the work (30, trips ÷ the
 * busiest one's trips). No score until at least one trip with an expected day has arrived.
 */
export function deliveryScore(d: DeliveryFigures, topTrips: number) {
  if (d.measured === 0) return null;
  const onTime = d.onTime / d.measured;
  const work = topTrips > 0 ? clamp01(d.trips / topTrips) : 0;
  const score = Math.round(70 * onTime + 30 * work);
  return { score, band: scoreBand(score), onTime, work };
}

/** Whole days from `from` to `to` (YYYY-MM-DD), negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Look-back periods offered on the scorecards (days), 90 by default. */
export const REPORT_WINDOWS = [30, 90, 180] as const;

export function windowDays(value: string | undefined): (typeof REPORT_WINDOWS)[number] {
  return REPORT_WINDOWS.find((w) => String(w) === value) ?? 90;
}
