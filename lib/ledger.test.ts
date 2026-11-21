import { describe, expect, it } from "vitest";

import { buildLedger, collectState, oldestUnpaidDay } from "@/lib/ledger";

describe("buildLedger", () => {
  it("orders by date, challans before payments on a day, with running balance", () => {
    const rows = buildLedger([
      { key: "p1", day: "2026-11-02", kind: "payment", label: "", debit: 0, credit: 500 },
      { key: "c2", day: "2026-11-02", kind: "challan", label: "", debit: 300, credit: 0 },
      { key: "c1", day: "2026-11-01", kind: "challan", label: "", debit: 1000, credit: 0 },
      { key: "o", day: "2026-11-01", kind: "opening", label: "", debit: 200, credit: 0 },
    ]);
    expect(rows.map((r) => r.key)).toEqual(["o", "c1", "c2", "p1"]);
    expect(rows.map((r) => r.balance)).toEqual([200, 1200, 1500, 1000]);
  });
  it("handles an empty ledger", () => {
    expect(buildLedger([])).toEqual([]);
  });
});

describe("collectState", () => {
  it("derives the state from what was received", () => {
    expect(collectState(1000, 1000, "to_pay")).toBe("settled");
    expect(collectState(1000, 400, "billed")).toBe("part");
    expect(collectState(1000, 0, "billed")).toBe("credit");
    expect(collectState(1000, 0, "to_pay")).toBe("pending");
  });
});

describe("oldestUnpaidDay", () => {
  const charges = [
    { day: "2026-10-01", amount: 1000 },
    { day: "2026-10-10", amount: 500 },
  ];
  it("applies payments to the oldest charge first", () => {
    expect(oldestUnpaidDay(charges, 0)).toBe("2026-10-01");
    expect(oldestUnpaidDay(charges, 1000)).toBe("2026-10-10");
    expect(oldestUnpaidDay(charges, 1499)).toBe("2026-10-10");
    expect(oldestUnpaidDay(charges, 1500)).toBeNull();
    expect(oldestUnpaidDay([], 0)).toBeNull();
  });
});
