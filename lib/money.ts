/** Money is integer paise. These are the only two places rupees and paise convert. */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const inrPlain = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** ₹1,23,456 (Indian grouping). Paise shown only when not whole rupees. */
export function formatMoney(paise: number): string {
  return inr.format(paise / 100);
}

/** 1,23,456.50 without the symbol, for tables and CSV. */
export function formatAmount(paise: number): string {
  return inrPlain.format(paise / 100);
}

/** Parses what the admin typed ("1,250", "1250.5", "₹ 900") into paise. Null when not a number. */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (cleaned === "" || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole = "0", fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** For prefilling an input: 125050 → "1250.5". */
export function paiseToInput(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

const inrCompact = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Chart labels: 24.5K, 1.2L, 1.2Cr. */
export function formatCompact(paise: number): string {
  return inrCompact.format(paise / 100);
}
