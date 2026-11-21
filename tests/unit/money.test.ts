import { describe, expect, it } from "vitest";

import { formatMoney, paiseToInput, parseRupees } from "@/lib/money";

describe("parseRupees", () => {
  it("reads plain, grouped and symbol input", () => {
    expect(parseRupees("1250")).toBe(125000);
    expect(parseRupees("1,25,000")).toBe(12500000);
    expect(parseRupees("₹ 900.5")).toBe(90050);
    expect(parseRupees("0.05")).toBe(5);
  });
  it("rejects junk, negatives and three decimals", () => {
    expect(parseRupees("")).toBeNull();
    expect(parseRupees("abc")).toBeNull();
    expect(parseRupees("-5")).toBeNull();
    expect(parseRupees("1.234")).toBeNull();
  });
});

describe("format", () => {
  it("uses Indian grouping", () => {
    expect(formatMoney(12345600)).toBe("₹1,23,456");
    expect(formatMoney(12345650)).toBe("₹1,23,456.5");
  });
  it("round-trips input", () => {
    expect(paiseToInput(125000)).toBe("1250");
    expect(paiseToInput(125050)).toBe("1250.50");
  });
});

describe("formatCompact", () => {
  it("uses lakh and crore", async () => {
    const { formatCompact } = await import("@/lib/money");
    expect(formatCompact(2450000)).toBe("24.5K");
    expect(formatCompact(12450000)).toBe("1.2L");
  });
});
