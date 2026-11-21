import { describe, expect, it } from "vitest";

import { parseRate, splitGst } from "@/lib/gst";

describe("splitGst", () => {
  it("adds GST on top when excluded", () => {
    expect(splitGst(100000, "excluded", 500)).toEqual({
      taxable: 100000,
      gstAmount: 5000,
      total: 105000,
    });
  });
  it("backs GST out when included, and parts add up exactly", () => {
    const r = splitGst(105000, "included", 500);
    expect(r).toEqual({ taxable: 100000, gstAmount: 5000, total: 105000 });
    const odd = splitGst(99999, "included", 1200);
    expect(odd.taxable + odd.gstAmount).toBe(99999);
  });
  it("is a no-op for none or zero rate", () => {
    expect(splitGst(5000, "none", 500)).toEqual({ taxable: 5000, gstAmount: 0, total: 5000 });
    expect(splitGst(5000, "excluded", 0)).toEqual({ taxable: 5000, gstAmount: 0, total: 5000 });
  });
});

describe("parseRate", () => {
  it("reads percent into basis points", () => {
    expect(parseRate("5")).toBe(500);
    expect(parseRate("12.5")).toBe(1250);
    expect(parseRate("40")).toBeNull();
    expect(parseRate("x")).toBeNull();
  });
});
