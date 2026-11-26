import { describe, expect, it } from "vitest";

import { daysBetween, deliveryScore, partyScore, scoreBand } from "@/lib/score";

describe("partyScore", () => {
  it("gives full marks to the biggest party who pays everything on time", () => {
    const s = partyScore({ billed: 100, received: 100, balance: 0, oldestDueDays: null }, 100);
    expect(s).toMatchObject({ score: 100, band: "good" });
  });
  it("marks down a party who doesn't pay and is long overdue", () => {
    const s = partyScore({ billed: 100, received: 0, balance: 100, oldestDueDays: 90 }, 100);
    expect(s).toMatchObject({ score: 20, band: "poor", pays: 0, onTime: 0 });
  });
  it("scales on-time between 15 and 60 days", () => {
    const s = partyScore({ billed: 0, received: 0, balance: 50, oldestDueDays: 37.5 }, 100);
    expect(s.onTime).toBeCloseTo(0.5);
  });
  it("treats a quiet party who owes nothing as paying in full", () => {
    expect(partyScore({ billed: 0, received: 0, balance: 0, oldestDueDays: null }, 100)).toMatchObject(
      { pays: 1, onTime: 1, business: 0, score: 80 },
    );
  });
});

describe("deliveryScore", () => {
  it("has no score until an expected trip has arrived", () => {
    expect(deliveryScore({ trips: 3, measured: 0, onTime: 0 }, 3)).toBeNull();
  });
  it("weights on-time 70 and work 30", () => {
    expect(deliveryScore({ trips: 2, measured: 2, onTime: 1 }, 4)).toMatchObject({
      score: 50,
      band: "watch",
    });
  });
});

describe("helpers", () => {
  it("bands scores", () => {
    expect([scoreBand(75), scoreBand(74), scoreBand(50), scoreBand(49)]).toEqual([
      "good",
      "watch",
      "watch",
      "poor",
    ]);
  });
  it("counts days between dates across a month end", () => {
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(daysBetween("2026-11-02", "2026-10-30")).toBe(-3);
  });
});
