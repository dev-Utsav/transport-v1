import { describe, expect, it } from "vitest";

import { calcSalary } from "@/lib/salary";

const base = { monthlySalary: 1500000, month: "2026-11", advance: 0, deduction: 0 };

describe("calcSalary", () => {
  it("pays the full month when present every day", () => {
    expect(calcSalary({ ...base, present: 30, halfDays: 0 })).toMatchObject({
      paidDays: 30,
      net: 1500000,
    });
  });
  it("counts half days as half and rounds to whole rupees", () => {
    const r = calcSalary({ ...base, present: 25, halfDays: 2 });
    expect(r.paidDays).toBe(26);
    expect(r.earned).toBe(1300000);
  });
  it("takes off advances and deductions but never goes negative", () => {
    expect(
      calcSalary({ ...base, present: 30, halfDays: 0, advance: 200000, deduction: 50000 }).net,
    ).toBe(1250000);
    expect(calcSalary({ ...base, present: 1, halfDays: 0, advance: 900000 }).net).toBe(0);
  });
  it("carries the advance the pay can't cover to next month", () => {
    // 1 day of ₹15,000/30 = ₹500 earned; ₹9,000 owed → ₹500 taken off, ₹8,500 carried.
    expect(calcSalary({ ...base, present: 1, halfDays: 0, advance: 900000 })).toMatchObject({
      earned: 50000,
      advanceCut: 50000,
      advanceCarried: 850000,
      net: 0,
    });
  });
  it("takes deductions before advances, so the carried part is what's really left", () => {
    expect(
      calcSalary({ ...base, present: 30, halfDays: 0, advance: 1000000, deduction: 1000000 }),
    ).toMatchObject({ advanceCut: 500000, advanceCarried: 500000, net: 0 });
  });
  it("caps paid days at the month length", () => {
    expect(calcSalary({ ...base, month: "2026-02", present: 31, halfDays: 0 }).paidDays).toBe(28);
  });
});
