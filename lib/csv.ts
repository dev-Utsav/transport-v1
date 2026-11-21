/** CSV that Excel opens cleanly: UTF-8 BOM (keeps Hindi text intact), CRLF, quoted cells. */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  const cell = (v: string | number) => {
    let s = String(v);
    // A text cell starting with = + - @ (or tab / CR) would run as a formula in Excel
    // (e.g. a party named =HYPERLINK(...)): prefix a quote so it stays text. Plain numbers
    // such as a loss "-1500.00" are left alone so Excel can still sum them.
    if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows].map((row) => row.map(cell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
