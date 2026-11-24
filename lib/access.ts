/**
 * Who may do what. Permissions are owned by the code (every key below is checked somewhere),
 * so this list is the source of truth and is synced into the `permissions` table on start.
 * Roles are data: the system roles below are seeded once, and an admin can change the
 * non-admin ones later. The Admin role always holds every permission.
 *
 * Roles agreed with Utsav (2026-11-21): admin, office, driver, helper. What each may do is our
 * sensible default, not the client's decision (open point in docs/PROGRESS.md).
 */

export const PERMISSIONS = [
  // Flow: Book → Load → On the road → Deliver → Collect
  "challans.view",
  "challans.book",
  "challans.edit",
  "challans.cancel",
  "trips.view",
  "trips.all", // every trip; without it a driver sees only trips where they are the driver
  "trips.manage", // new / edit trip, correct a status
  "trips.load", // put parcels on a loading truck, take them off
  "trips.advance", // truck has left, truck has arrived, close
  "trips.deliver", // mark a parcel delivered, collecting To-Pay money in the same tap
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

export const SYSTEM_ROLES = ["admin", "office", "driver", "helper"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const ROLE_NAMES = {
  admin: "Admin",
  office: "Office",
  driver: "Driver",
  helper: "Helper",
} as const satisfies Record<SystemRole, string>;

/**
 * Permissions each system role starts with.
 * - admin: everything (never stored short; topped up on every start).
 * - office: the day's desk work. Cancelling money records, salaries, settings, backups,
 *   change history and logins stay with the admin.
 * - driver: only their own trips (no `trips.all`): see them, mark left / arrived, deliver and
 *   collect. Their login must be linked to their staff record (users.staff_id).
 * - helper: loading on any truck: see trips and parcels, load and unload.
 */
export const DEFAULT_ROLE_PERMISSIONS = {
  admin: PERMISSIONS,
  office: [
    "challans.view",
    "challans.book",
    "challans.edit",
    "trips.view",
    "trips.all",
    "trips.manage",
    "trips.load",
    "trips.advance",
    "trips.deliver",
    "parties.view",
    "parties.manage",
    "payments.record",
    "expenses.view",
    "expenses.record",
    "gst.view",
    "reports.view",
    "reports.export",
    "masters.manage",
  ],
  driver: ["trips.view", "trips.advance", "trips.deliver"],
  helper: ["challans.view", "trips.view", "trips.all", "trips.load"],
} as const satisfies Record<SystemRole, readonly Permission[]>;

export function isPermission(value: string): value is Permission {
  const all: readonly string[] = PERMISSIONS;
  return all.includes(value);
}

export function isSystemRole(value: string | null): value is SystemRole {
  const all: readonly (string | null)[] = SYSTEM_ROLES;
  return all.includes(value);
}

/** The union of permissions from every role a user holds (unknown keys are dropped). */
export function permissionSet(keys: readonly string[]): ReadonlySet<Permission> {
  return new Set(keys.filter(isPermission));
}
