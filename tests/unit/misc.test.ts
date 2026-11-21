import { describe, expect, it } from "vitest";

import { formatChallanNo } from "@/lib/challan-no";
import { toCsv } from "@/lib/csv";
import { daysInMonth, istDay, monthRange, shiftMonth } from "@/lib/dates";
import { waNumber } from "@/lib/whatsapp";

describe("dates", () => {
  it("uses IST for today", () => {
    expect(istDay(new Date("2026-11-20T19:00:00Z"))).toBe("2026-11-21");
    expect(istDay(new Date("2026-11-20T18:00:00Z"))).toBe("2026-11-20");
  });
  it("knows month lengths and ranges", () => {
    expect(daysInMonth("2028-02")).toBe(29);
    expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("waNumber", () => {
  it("normalises Indian mobiles", () => {
    expect(waNumber("98250 12345")).toBe("919825012345");
    expect(waNumber("+91 98250-12345")).toBe("919825012345");
    expect(waNumber("098250 12345")).toBe("919825012345");
    expect(waNumber("12345")).toBe("");
  });
});

describe("csv and numbering", () => {
  it("quotes cells that need it and starts with a BOM", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"']])).toBe('﻿a,b\r\n"x,y","say ""hi"""\r\n');
  });
  it("keeps text that looks like a formula as text, but not negative amounts", () => {
    const csv = toCsv(
      ["name", "amt"],
      [
        ['=HYPERLINK("x")', "-1500.00"],
        ["@SUM(A1)", "+5"],
      ],
    );
    expect(csv).toContain(`"'=HYPERLINK(""x"")",-1500.00`);
    expect(csv).toContain("'@SUM(A1),+5");
  });
  it("pads the serial", () => {
    expect(formatChallanNo(42, "KDR/")).toBe("KDR/0042");
    expect(formatChallanNo(12345, "")).toBe("12345");
  });
});
