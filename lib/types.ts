/** Every fixed choice in the tool, as const arrays so forms, Zod and labels share one list. */

export const TRIP_STATUSES = ["loading", "in_transit", "arrived", "closed"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const CHALLAN_STATUSES = ["booked", "loaded", "in_transit", "delivered"] as const;
export type ChallanStatus = (typeof CHALLAN_STATUSES)[number];

export const PAY_TYPES = ["paid", "to_pay", "billed"] as const;
export type PayType = (typeof PAY_TYPES)[number];

export const PAY_MODES = ["cash", "upi", "bank"] as const;
export type PayMode = (typeof PAY_MODES)[number];

export const GST_MODES = ["none", "included", "excluded"] as const;
export type GstMode = (typeof GST_MODES)[number];

export const TRUCK_OWNERS = ["own", "hired"] as const;
export type TruckOwner = (typeof TRUCK_OWNERS)[number];

export const VENDOR_KINDS = ["sender", "receiver", "both"] as const;
export type VendorKind = (typeof VENDOR_KINDS)[number];

export const EMPLOYEE_ROLES = ["driver", "helper", "office"] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

/** Built-in expense categories; the admin can add more in Settings (stored as plain text). */
export const DEFAULT_EXPENSE_CATEGORIES = [
  "diesel",
  "toll",
  "driver",
  "repairs",
  "tyres",
  "loading",
  "office",
  "hire",
  "other",
] as const;

/** Built-ins first, the admin's own next, "other" last; no duplicates. */
export function expenseCategoryList(saved: readonly string[]): string[] {
  const builtIn: readonly string[] = DEFAULT_EXPENSE_CATEGORIES;
  const custom = saved.filter((c) => !builtIn.includes(c));
  return [...DEFAULT_EXPENSE_CATEGORIES.filter((c) => c !== "other"), ...custom, "other"];
}

/** How much of a challan has been collected, derived from the payments linked to it. */
export type CollectState = "settled" | "part" | "pending" | "credit";
