/**
 * Who may do what. Permissions are owned by the code (every key below is checked somewhere),
 * so this list is the source of truth and is synced into the `permissions` table on start.
 * Roles are data: the system roles below are seeded once, and the owner can change the
 * non-owner ones later. The Owner role always holds every permission.
 *
 * The default matrix is our sensible default, not the client's decision (open point in
 * docs/PROGRESS.md).
 */

export const PERMISSIONS = [
  // Flow: Book → Load → On the road → Deliver → Collect
  "challans.view",
  "challans.book",
  "challans.edit",
  "challans.cancel",
  "trips.view",
  "trips.manage", // new trip, load / unload, advance status, deliver
  "parties.view",
  "parties.manage",
  "payments.record",
  "payments.cancel",
  // Office work
  "expenses.view",
  "expenses.record",
  "expenses.cancel",
  "salary.view",
  "salary.manage",
  "gst.view",
  "reports.view",
  "reports.export",
  "masters.manage", // trucks, drivers, staff
  "settings.manage",
  "backup.download",
  "audit.view",
  "users.manage", // users, roles, who holds which role
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const SYSTEM_ROLES = ["owner", "manager", "accountant", "booking_clerk"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

/** Permissions each system role starts with. Owner is "everything" and is never stored short. */
export const DEFAULT_ROLE_PERMISSIONS = {
  owner: PERMISSIONS,
  manager: PERMISSIONS.filter(
    (p) => p !== "users.manage" && p !== "settings.manage" && p !== "backup.download",
  ),
  accountant: [
    "challans.view",
    "trips.view",
    "parties.view",
    "parties.manage",
    "payments.record",
    "payments.cancel",
    "expenses.view",
    "expenses.record",
    "expenses.cancel",
    "salary.view",
    "salary.manage",
    "gst.view",
    "reports.view",
    "reports.export",
    "audit.view",
  ],
  booking_clerk: [
    "challans.view",
    "challans.book",
    "challans.edit",
    "trips.view",
    "trips.manage",
    "parties.view",
    "payments.record",
    "expenses.record",
  ],
} as const satisfies Record<SystemRole, readonly Permission[]>;

export function isPermission(value: string): value is Permission {
  const all: readonly string[] = PERMISSIONS;
  return all.includes(value);
}

/** The union of permissions from every role a user holds (unknown keys are dropped). */
export function permissionSet(keys: readonly string[]): ReadonlySet<Permission> {
  return new Set(keys.filter(isPermission));
}
