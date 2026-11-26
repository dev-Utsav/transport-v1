import { describe, expect, it } from "vitest";

import { challanNext, sortForTruck, tripNextAction, tripStage } from "@/lib/flow";

describe("trip flow", () => {
  it("offers one next action per status", () => {
    const on = { loaded: 3, undelivered: 3, due: 0 };
    expect(tripNextAction("loading", on)).toBe("dispatch");
    expect(tripNextAction("in_transit", on)).toBe("arrive");
    expect(tripNextAction("arrived", { ...on, undelivered: 2 })).toBe("deliver");
    expect(tripNextAction("arrived", { ...on, undelivered: 0 })).toBe("close");
    expect(tripNextAction("closed", { ...on, undelivered: 0 })).toBeNull();
  });
  it("asks to load before the truck can leave, and to collect after it closes", () => {
    expect(tripNextAction("loading", { loaded: 0, undelivered: 0, due: 0 })).toBe("load");
    expect(tripNextAction("closed", { loaded: 3, undelivered: 0, due: 2990000 })).toBe("collect");
  });
  it("maps statuses to stages", () => {
    expect(tripStage("loading")).toBe("load");
    expect(tripStage("closed")).toBe("collect");
  });
});

describe("challan flow", () => {
  const base = {
    isCancelled: false,
    status: "booked" as const,
    tripId: null,
    tripStatus: null,
    due: 500,
  };
  it("asks to load a booked parcel with no truck", () => {
    expect(challanNext(base)).toEqual({ kind: "load" });
  });
  it("follows the truck", () => {
    expect(challanNext({ ...base, status: "loaded", tripId: 4, tripStatus: "loading" })).toEqual({
      kind: "wait-dispatch",
      tripId: 4,
    });
    expect(
      challanNext({ ...base, status: "in_transit", tripId: 4, tripStatus: "in_transit" }),
    ).toEqual({ kind: "on-road", tripId: 4 });
    expect(
      challanNext({ ...base, status: "in_transit", tripId: 4, tripStatus: "arrived" }),
    ).toEqual({ kind: "deliver", tripId: 4 });
  });
  it("collects after delivery, then is done", () => {
    expect(challanNext({ ...base, status: "delivered", tripId: 4, tripStatus: "closed" })).toEqual({
      kind: "collect",
      due: 500,
    });
    expect(
      challanNext({ ...base, status: "delivered", tripId: 4, tripStatus: "closed", due: 0 }),
    ).toEqual({ kind: "done" });
    expect(challanNext({ ...base, isCancelled: true })).toEqual({ kind: "cancelled" });
  });
});

describe("sortForTruck", () => {
  it("puts parcels for the truck's destination first, then oldest", () => {
    const rows = [
      { id: 1, toPlace: "Baroda", bookedOn: "2026-11-01" },
      { id: 2, toPlace: "Delhi", bookedOn: "2026-11-05" },
      { id: 3, toPlace: "delhi ", bookedOn: "2026-11-02" },
    ];
    expect(sortForTruck(rows, "Delhi").map((r) => r.id)).toEqual([3, 2, 1]);
  });
});
