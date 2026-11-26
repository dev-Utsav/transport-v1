import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type {
  ChallanStatus,
  GstMode,
  PayMode,
  PayType,
  StaffRole,
  TripStatus,
  TruckOwner,
  VendorKind,
} from "@/lib/types";

/**
 * Money is whole paise (integer) everywhere: no floating point rounding in totals.
 * GST rates are basis points (5% = 500). Dates without time are `YYYY-MM-DD` strings in IST.
 * Nothing is ever hard-deleted: records are cancelled, masters are deactivated, edits are logged.
 */

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const settings = pgTable("settings", {
  id: smallint("id").primaryKey().default(1),
  businessName: text("business_name").notNull().default(""),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  gstin: text("gstin").notNull().default(""),
  gstRateBp: integer("gst_rate_bp").notNull().default(500),
  gstMode: text("gst_mode").$type<GstMode>().notNull().default("none"),
  challanPrefix: text("challan_prefix").notNull().default(""),
  nextChallanNo: integer("next_challan_no").notNull().default(1),
  openingCash: integer("opening_cash").notNull().default(0),
  reminderDays: integer("reminder_days").notNull().default(15),
  expenseCategories: text("expense_categories")
    .array()
    .notNull()
    .default(
      sql`ARRAY['diesel','toll','driver','repairs','tyres','loading','office','hire','other']`,
    ),
});

export const trucks = pgTable("trucks", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  type: text("type").notNull().default(""),
  owner: text("owner").$type<TruckOwner>().notNull().default("own"),
  ownerName: text("owner_name").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

/**
 * Everyone who works for the business: drivers, helpers, office. One record per person, so a
 * salaried driver is picked on trips and paid salary from the same row. A hired truck's driver
 * is staff with on_payroll = false (picked on trips, never paid salary here).
 */
export const staff = pgTable(
  "staff",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    // Job role (what they do). Login roles are separate: see `roles` / `user_roles`.
    role: text("role").$type<StaffRole>().notNull(),
    licence: text("licence").notNull().default(""),
    onPayroll: boolean("on_payroll").notNull().default(false),
    monthlySalary: integer("monthly_salary").notNull().default(0),
    joinedOn: date("joined_on"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("staff_role_idx").on(t.role),
    check(
      "staff_payroll_check",
      sql`not ${t.onPayroll} or (${t.monthlySalary} > 0 and ${t.joinedOn} is not null)`,
    ),
  ],
);

export const trips = pgTable(
  "trips",
  {
    id: serial("id").primaryKey(),
    truckId: integer("truck_id")
      .notNull()
      .references(() => trucks.id),
    driverId: integer("driver_id").references(() => staff.id),
    fromPlace: text("from_place").notNull(),
    toPlace: text("to_place").notNull(),
    departOn: date("depart_on").notNull(),
    expectedOn: date("expected_on"),
    status: text("status").$type<TripStatus>().notNull().default("loading"),
    // IST day the truck was marked arrived (set by the status change; on-time = arrivedOn <= expectedOn).
    arrivedOn: date("arrived_on"),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [
    index("trips_depart_idx").on(t.departOn),
    index("trips_truck_idx").on(t.truckId),
    index("trips_driver_idx").on(t.driverId),
  ],
);

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  gstin: text("gstin").notNull().default(""),
  kind: text("kind").$type<VendorKind>().notNull().default("both"),
  // Old paper balance carried in when the vendor was added (positive = they owe us).
  openingBalance: integer("opening_balance").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const challans = pgTable(
  "challans",
  {
    id: serial("id").primaryKey(),
    no: integer("no").notNull().unique(),
    bookedOn: date("booked_on").notNull(),
    tripId: integer("trip_id").references(() => trips.id),
    senderId: integer("sender_id")
      .notNull()
      .references(() => vendors.id),
    receiverId: integer("receiver_id")
      .notNull()
      .references(() => vendors.id),
    // The party who owes the freight: sender for Paid / Billed later, receiver for To-Pay.
    partyId: integer("party_id")
      .notNull()
      .references(() => vendors.id),
    fromPlace: text("from_place").notNull(),
    toPlace: text("to_place").notNull(),
    packages: integer("packages").notNull(),
    description: text("description").notNull().default(""),
    weightKg: integer("weight_kg").notNull().default(0),
    freight: integer("freight").notNull(),
    gstMode: text("gst_mode").$type<GstMode>().notNull().default("none"),
    gstRateBp: integer("gst_rate_bp").notNull().default(0),
    // Stored once at booking so reports never recompute GST with a changed rate.
    taxable: integer("taxable").notNull(),
    gstAmount: integer("gst_amount").notNull(),
    total: integer("total").notNull(),
    payType: text("pay_type").$type<PayType>().notNull(),
    status: text("status").$type<ChallanStatus>().notNull().default("booked"),
    isCancelled: boolean("is_cancelled").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("challans_trip_idx").on(t.tripId),
    index("challans_party_idx").on(t.partyId),
    index("challans_booked_idx").on(t.bookedOn),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => vendors.id),
    challanId: integer("challan_id").references(() => challans.id),
    amount: integer("amount").notNull(),
    mode: text("mode").$type<PayMode>().notNull(),
    paidOn: date("paid_on").notNull(),
    note: text("note").notNull().default(""),
    isCancelled: boolean("is_cancelled").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("payments_vendor_idx").on(t.vendorId),
    index("payments_challan_idx").on(t.challanId),
    index("payments_paid_idx").on(t.paidOn),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    spentOn: date("spent_on").notNull(),
    amount: integer("amount").notNull(),
    category: text("category").notNull(),
    mode: text("mode").$type<PayMode>().notNull(),
    truckId: integer("truck_id").references(() => trucks.id),
    tripId: integer("trip_id").references(() => trips.id),
    note: text("note").notNull().default(""),
    hasPhoto: boolean("has_photo").notNull().default(false),
    isCancelled: boolean("is_cancelled").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_spent_idx").on(t.spentOn), index("expenses_trip_idx").on(t.tripId)],
);

// Kept apart from `expenses` so list queries never pull image bytes.
export const billPhotos = pgTable("bill_photos", {
  expenseId: integer("expense_id")
    .primaryKey()
    .references(() => expenses.id),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
});

export const salaryMonths = pgTable(
  "salary_months",
  {
    id: serial("id").primaryKey(),
    staffId: integer("staff_id")
      .notNull()
      .references(() => staff.id),
    month: text("month").notNull(),
    // Salary on file for that month, frozen so a later raise doesn't rewrite old slips.
    monthlySalary: integer("monthly_salary").notNull(),
    present: integer("present").notNull().default(0),
    absent: integer("absent").notNull().default(0),
    halfDays: integer("half_days").notNull().default(0),
    advance: integer("advance").notNull().default(0),
    deduction: integer("deduction").notNull().default(0),
    note: text("note").notNull().default(""),
    paidOn: date("paid_on"),
    paidMode: text("paid_mode").$type<PayMode>(),
    paidAmount: integer("paid_amount"),
  },
  (t) => [uniqueIndex("salary_staff_month_idx").on(t.staffId, t.month)],
);

/**
 * Cash advances to staff (the khata): many small amounts, any day. Never edited, only cancelled.
 * Each month's salary takes off what is owed (advances given up to the month's end minus what
 * earlier months already took off, `salary_months.advance`); what the pay can't cover carries on.
 */
export const staffAdvances = pgTable(
  "staff_advances",
  {
    id: serial("id").primaryKey(),
    staffId: integer("staff_id")
      .notNull()
      .references(() => staff.id),
    givenOn: date("given_on").notNull(),
    amount: integer("amount").notNull(),
    mode: text("mode").$type<PayMode>().notNull(),
    note: text("note").notNull().default(""),
    isCancelled: boolean("is_cancelled").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("staff_advances_staff_idx").on(t.staffId, t.givenOn),
    index("staff_advances_given_idx").on(t.givenOn),
    check("staff_advances_amount_check", sql`${t.amount} > 0`),
  ],
);

/* ---------- Access: users, roles, permissions (RBAC) ----------
 * Permission keys are owned by the code (`lib/access.ts`) and synced into `permissions` on start,
 * so role_permissions always point at a real key. Users are never deleted, only deactivated
 * (the audit log points at them). Bumping `session_version` signs that user out everywhere.
 */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    // What they type to sign in: a phone number or a short user name.
    login: text("login").notNull(),
    phone: text("phone").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    // Set when the owner resets a password: the person must choose a new one on next sign-in.
    mustChangePassword: boolean("must_change_password").notNull().default(true),
    sessionVersion: integer("session_version").notNull().default(1),
    // The staff record this login belongs to. Required for the driver role (they see only
    // trips where trips.driver_id = staff_id); empty for an admin who isn't staff.
    staffId: integer("staff_id").references(() => staff.id),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_login_idx").on(sql`lower(${t.login})`),
    uniqueIndex("users_staff_idx").on(t.staffId),
  ],
);

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  // System roles have a fixed key (`lib/access.ts` SYSTEM_ROLES); roles the owner adds have null.
  key: text("key").unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
  // Kept (not deleted) when the code drops a key, so old role rows stay valid; ignored at check time.
  isRetired: boolean("is_retired").notNull().default(false),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionKey] }),
    index("role_permissions_perm_idx").on(t.permissionKey),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id),
    grantedBy: integer("granted_by").references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index("user_roles_role_idx").on(t.roleId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    // Who made the change. Null for system jobs and for history from before logins existed.
    actorId: integer("actor_id").references(() => users.id),
    entity: text("entity").notNull(),
    entityId: integer("entity_id").notNull(),
    action: text("action").$type<"create" | "update" | "cancel">().notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    at: createdAt(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entity, t.entityId),
    index("audit_actor_idx").on(t.actorId),
  ],
);

export const backups = pgTable("backups", {
  id: serial("id").primaryKey(),
  takenAt: createdAt(),
  sizeBytes: integer("size_bytes").notNull(),
  // gzip of the JSON export.
  data: bytea("data").notNull(),
});
