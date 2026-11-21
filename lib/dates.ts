/**
 * The business runs on India time. "Today" and month boundaries are computed in IST,
 * never with UTC midnight (which would flip the day at 5:30 am).
 */

const IST_OFFSET_MS = 330 * 60 * 1000;

/** YYYY-MM-DD for the given instant, in IST. */
export function istDay(at: Date = new Date()): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** YYYY-MM for the given instant, in IST. */
export function istMonth(at: Date = new Date()): string {
  return istDay(at).slice(0, 7);
}

export function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, m ?? 1, 0)).getUTCDate();
}

/** First and last day of a month, for `between` queries. */
export function monthRange(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: `${month}-${String(daysInMonth(month)).padStart(2, "0")}` };
}

export function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function shiftMonth(month: string, delta: number): string {
  const [y = 1970, m = 1] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

const dayFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const dayYearFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const monthFmt = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "20 Nov" (same year as today) or "20 Nov 2025". */
export function formatDay(day: string, today: string = istDay()): string {
  const d = new Date(`${day}T00:00:00Z`);
  return day.slice(0, 4) === today.slice(0, 4) ? dayFmt.format(d) : dayYearFmt.format(d);
}

export function formatDayFull(day: string): string {
  return dayYearFmt.format(new Date(`${day}T00:00:00Z`));
}

export function formatMonth(month: string): string {
  return monthFmt.format(new Date(`${month}-01T00:00:00Z`));
}
