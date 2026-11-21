import type { ChallanStatus, TripStatus } from "@/lib/types";

/**
 * The one flow the whole desk follows. Every screen shows where a record is on it and
 * offers exactly one next action.
 *   1 Book     → a challan is made for the parcel
 *   2 Load     → the parcel is put on a truck (a trip that is loading)
 *   3 On road  → the truck leaves
 *   4 Deliver  → the truck arrives, parcels are handed over (To-Pay money taken here)
 *   5 Collect  → whatever is still owed is collected; the trip is closed
 */
export const FLOW = ["book", "load", "road", "deliver", "collect"] as const;
export type FlowStage = (typeof FLOW)[number];

export type TripAction = "dispatch" | "arrive" | "deliver" | "close";

/** Where a trip sits on the flow. */
export function tripStage(status: TripStatus): FlowStage {
  if (status === "loading") return "load";
  if (status === "in_transit") return "road";
  if (status === "arrived") return "deliver";
  return "collect";
}

/** The single next action on a trip, or null when it is closed. */
export function tripNextAction(status: TripStatus, undelivered: number): TripAction | null {
  if (status === "loading") return "dispatch";
  if (status === "in_transit") return "arrive";
  if (status === "arrived") return undelivered > 0 ? "deliver" : "close";
  return null;
}

/** Status a trip moves to for an action (deliver happens per parcel, not on the trip). */
export const TRIP_ACTION_TO: Record<Exclude<TripAction, "deliver">, TripStatus> = {
  dispatch: "in_transit",
  arrive: "arrived",
  close: "closed",
};

export type ChallanNext =
  | { kind: "load" }
  | { kind: "wait-dispatch"; tripId: number }
  | { kind: "on-road"; tripId: number }
  | { kind: "deliver"; tripId: number | null }
  | { kind: "collect"; due: number }
  | { kind: "done" }
  | { kind: "cancelled" };

/** What should happen next to one challan. */
export function challanNext(c: {
  isCancelled: boolean;
  status: ChallanStatus;
  tripId: number | null;
  tripStatus: TripStatus | null;
  due: number;
}): ChallanNext {
  if (c.isCancelled) return { kind: "cancelled" };
  if (c.status === "delivered")
    return c.due > 0 ? { kind: "collect", due: c.due } : { kind: "done" };
  if (c.tripId === null)
    return c.status === "booked" ? { kind: "load" } : { kind: "deliver", tripId: null };
  if (c.tripStatus === "loading") return { kind: "wait-dispatch", tripId: c.tripId };
  if (c.tripStatus === "in_transit") return { kind: "on-road", tripId: c.tripId };
  return { kind: "deliver", tripId: c.tripId };
}

export function challanStage(next: ChallanNext): FlowStage | null {
  switch (next.kind) {
    case "load":
      return "load";
    case "wait-dispatch":
      return "load";
    case "on-road":
      return "road";
    case "deliver":
      return "deliver";
    case "collect":
      return "collect";
    default:
      return null;
  }
}

/** Waiting parcels for a truck: those going where the truck goes come first, then oldest first. */
export function sortForTruck<T extends { toPlace: string; bookedOn: string; id: number }>(
  rows: readonly T[],
  toPlace: string,
): T[] {
  const target = toPlace.trim().toLowerCase();
  return [...rows].sort((a, b) => {
    const am = a.toPlace.trim().toLowerCase() === target ? 0 : 1;
    const bm = b.toPlace.trim().toLowerCase() === target ? 0 : 1;
    return am - bm || a.bookedOn.localeCompare(b.bookedOn) || a.id - b.id;
  });
}
