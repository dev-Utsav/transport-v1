import "server-only";

import { istDay, shiftDay } from "@/lib/dates";
import { splitGst } from "@/lib/gst";
import type { ChallanStatus, PayType } from "@/lib/types";
import type { Database } from "@/server/db";
import {
  auditLog,
  backups,
  billPhotos,
  challans,
  staff,
  expenses,
  payments,
  roles,
  salaryMonths,
  staffAdvances,
  settings,
  trips,
  trucks,
  userRoles,
  users,
  vendors,
} from "@/server/db/schema";

/**
 * Sample data for the practice desk (and `SEED_DEMO=1` locally). Shaped so every flow step has
 * work waiting: parcels to load, a truck loading for Delhi, one on the road, money to collect.
 * Names are made up.
 */
export async function seedSampleIfEmpty(db: Database): Promise<void> {
  const existing = await db.select({ id: trucks.id }).from(trucks).limit(1);
  if (existing.length > 0) return;
  const today = istDay();
  const d = (n: number) => shiftDay(today, -n);
  const month = today.slice(0, 7);

  await db.transaction(async (tx) => {
    await tx.update(settings).set({
      businessName: "Sample Transport Co.",
      address: "Kadodara, Surat",
      phone: "9800000000",
      challanPrefix: "KDR/",
      nextChallanNo: 1,
      openingCash: 2500000,
    });
    const [t1, t2, t3] = await tx
      .insert(trucks)
      .values([
        { number: "GJ06AX4521", type: "32 ft container", owner: "own" },
        { number: "GJ06BT1187", type: "22 ft open body", owner: "own" },
        {
          number: "RJ14GC9034",
          type: "32 ft container",
          owner: "hired",
          ownerName: "Mahadev Carriers",
        },
      ])
      .returning();
    // One staff record per person: Ramesh and Suresh drive and are on salary; Imran drives the
    // hired truck and is paid by its owner (off payroll).
    const [r1, r2, r3] = await tx
      .insert(staff)
      .values([
        {
          name: "Ramesh Yadav",
          phone: "9800000001",
          role: "driver",
          licence: "GJ0620190012345",
          onPayroll: true,
          monthlySalary: 2200000,
          joinedOn: "2023-04-01",
        },
        {
          name: "Suresh Patel",
          phone: "9800000002",
          role: "driver",
          licence: "GJ0620170067890",
          onPayroll: true,
          monthlySalary: 2000000,
          joinedOn: "2024-01-15",
        },
        { name: "Imran Shaikh", phone: "9800000003", role: "driver", licence: "RJ1420180034567" },
      ])
      .returning();
    const [patel, shah, jain, gupta, mehta, agarwal] = await tx
      .insert(vendors)
      .values([
        {
          name: "Patel Textiles",
          phone: "9800000011",
          address: "Kadodara GIDC, Surat",
          kind: "sender",
        },
        {
          name: "Shah Synthetics",
          phone: "9800000012",
          address: "Palsana, Surat",
          kind: "sender",
          openingBalance: 1850000,
        },
        {
          name: "Jain Fabrics",
          phone: "9800000013",
          address: "Chandni Chowk, Delhi",
          kind: "receiver",
        },
        {
          name: "Gupta Traders",
          phone: "9800000014",
          address: "Karol Bagh, Delhi",
          kind: "receiver",
        },
        { name: "Mehta Sarees", phone: "9800000015", address: "Alkapuri, Baroda", kind: "both" },
        { name: "Agarwal Yarn", phone: "9800000016", address: "Kadodara", kind: "sender" },
      ])
      .returning();
    if (
      !t1 ||
      !t2 ||
      !t3 ||
      !r1 ||
      !r2 ||
      !r3 ||
      !patel ||
      !shah ||
      !jain ||
      !gupta ||
      !mehta ||
      !agarwal
    )
      return;

    const [loading, road, closed] = await tx
      .insert(trips)
      .values([
        {
          truckId: t2.id,
          driverId: r2.id,
          fromPlace: "Kadodara",
          toPlace: "Delhi",
          departOn: today,
          expectedOn: shiftDay(today, 3),
          status: "loading",
        },
        {
          truckId: t1.id,
          driverId: r1.id,
          fromPlace: "Kadodara",
          toPlace: "Delhi",
          departOn: d(1),
          expectedOn: shiftDay(today, 2),
          status: "in_transit",
        },
        {
          truckId: t3.id,
          driverId: r3.id,
          fromPlace: "Kadodara",
          toPlace: "Delhi",
          departOn: d(9),
          expectedOn: d(6),
          status: "closed",
        },
      ])
      .returning();
    if (!loading || !road || !closed) return;

    type Seed = {
      trip: number | null;
      day: string;
      s: number;
      r: number;
      to: string;
      pk: number;
      desc: string;
      fr: number;
      pay: PayType;
      gst?: boolean;
      status: ChallanStatus;
    };
    const seeds: Seed[] = [
      {
        trip: closed.id,
        day: d(10),
        s: patel.id,
        r: jain.id,
        to: "Delhi",
        pk: 40,
        desc: "Grey cloth bales",
        fr: 1800000,
        pay: "billed",
        gst: true,
        status: "delivered",
      },
      {
        trip: closed.id,
        day: d(10),
        s: shah.id,
        r: gupta.id,
        to: "Delhi",
        pk: 25,
        desc: "Polyester rolls",
        fr: 1100000,
        pay: "to_pay",
        status: "delivered",
      },
      {
        trip: closed.id,
        day: d(9),
        s: agarwal.id,
        r: jain.id,
        to: "Delhi",
        pk: 18,
        desc: "Yarn cones",
        fr: 650000,
        pay: "paid",
        status: "delivered",
      },
      {
        trip: road.id,
        day: d(2),
        s: patel.id,
        r: gupta.id,
        to: "Delhi",
        pk: 60,
        desc: "Printed sarees",
        fr: 2400000,
        pay: "billed",
        gst: true,
        status: "in_transit",
      },
      {
        trip: road.id,
        day: d(2),
        s: shah.id,
        r: jain.id,
        to: "Delhi",
        pk: 30,
        desc: "Dress material",
        fr: 1250000,
        pay: "to_pay",
        status: "in_transit",
      },
      {
        trip: loading.id,
        day: today,
        s: agarwal.id,
        r: gupta.id,
        to: "Delhi",
        pk: 12,
        desc: "Yarn cones",
        fr: 480000,
        pay: "to_pay",
        status: "loaded",
      },
      {
        trip: null,
        day: d(1),
        s: patel.id,
        r: jain.id,
        to: "Delhi",
        pk: 20,
        desc: "Saree boxes",
        fr: 900000,
        pay: "to_pay",
        status: "booked",
      },
      {
        trip: null,
        day: today,
        s: shah.id,
        r: gupta.id,
        to: "Delhi",
        pk: 8,
        desc: "Lace rolls",
        fr: 320000,
        pay: "billed",
        status: "booked",
      },
      {
        trip: null,
        day: today,
        s: agarwal.id,
        r: mehta.id,
        to: "Baroda",
        pk: 15,
        desc: "Fabric bundles",
        fr: 280000,
        pay: "paid",
        status: "booked",
      },
      {
        trip: null,
        day: d(25),
        s: mehta.id,
        r: jain.id,
        to: "Delhi",
        pk: 10,
        desc: "Sarees",
        fr: 520000,
        pay: "billed",
        status: "delivered",
      },
    ];
    let no = 1;
    for (const s of seeds) {
      const gst = splitGst(s.fr, s.gst ? "excluded" : "none", s.gst ? 500 : 0);
      const [c] = await tx
        .insert(challans)
        .values({
          no: no++,
          bookedOn: s.day,
          tripId: s.trip,
          senderId: s.s,
          receiverId: s.r,
          partyId: s.pay === "to_pay" ? s.r : s.s,
          fromPlace: "Kadodara",
          toPlace: s.to,
          packages: s.pk,
          description: s.desc,
          freight: s.fr,
          gstMode: s.gst ? "excluded" : "none",
          gstRateBp: s.gst ? 500 : 0,
          ...gst,
          payType: s.pay,
          status: s.status,
        })
        .returning();
      if (c && s.pay === "paid")
        await tx.insert(payments).values({
          vendorId: s.s,
          challanId: c.id,
          amount: gst.total,
          mode: "cash",
          paidOn: s.day,
        });
    }
    await tx.update(settings).set({ nextChallanNo: no });

    await tx.insert(payments).values([
      { vendorId: gupta.id, amount: 1100000, mode: "upi", paidOn: d(5), note: "On delivery" },
      { vendorId: patel.id, amount: 1000000, mode: "bank", paidOn: d(3), note: "Part payment" },
    ]);
    await tx.insert(expenses).values([
      {
        spentOn: d(9),
        amount: 2200000,
        category: "diesel",
        mode: "cash",
        truckId: t3.id,
        tripId: closed.id,
      },
      {
        spentOn: d(9),
        amount: 380000,
        category: "toll",
        mode: "upi",
        truckId: t3.id,
        tripId: closed.id,
      },
      {
        spentOn: d(9),
        amount: 1500000,
        category: "hire",
        mode: "bank",
        truckId: t3.id,
        tripId: closed.id,
        note: "Mahadev Carriers",
      },
      {
        spentOn: d(1),
        amount: 2450000,
        category: "diesel",
        mode: "bank",
        truckId: t1.id,
        tripId: road.id,
      },
      { spentOn: today, amount: 120000, category: "office", mode: "cash", note: "Tea, stationery" },
    ]);
    await tx.insert(staff).values([
      {
        name: "Kishan Rathod",
        role: "helper",
        onPayroll: true,
        monthlySalary: 1200000,
        joinedOn: "2024-06-01",
      },
      {
        name: "Neha Desai",
        role: "office",
        onPayroll: true,
        monthlySalary: 1800000,
        joinedOn: "2022-08-01",
      },
    ]);
    const [e1, e2] = [r1, r2];
    if (e1 && e2) {
      await tx.insert(salaryMonths).values([
        {
          staffId: e1.id,
          month,
          monthlySalary: e1.monthlySalary,
          present: 18,
          absent: 1,
          halfDays: 1,
        },
        {
          staffId: e2.id,
          month,
          monthlySalary: e2.monthlySalary,
          present: 19,
          absent: 0,
          halfDays: 0,
        },
      ]);
      // Small cash advances through the month (the khata), taken off salary automatically.
      await tx.insert(staffAdvances).values(
        [
          { staffId: e1.id, day: 3, amount: 100000 },
          { staffId: e1.id, day: 3, amount: 20000 },
          { staffId: e1.id, day: 9, amount: 150000 },
          { staffId: e2.id, day: 12, amount: 25000 },
          { staffId: e1.id, day: 15, amount: 30000 },
        ].map(({ day, ...a }) => ({
          ...a,
          givenOn: `${month}-${String(Math.min(day, Number(today.slice(8)))).padStart(2, "0")}`,
          mode: "cash" as const,
        })),
      );
    }
  });
}

/** Practice desk "Start over": empty every table (children first) and load the sample again. */
export async function resetSample(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of [
      billPhotos,
      payments,
      expenses,
      challans,
      trips,
      staffAdvances,
      salaryMonths,
      vendors,
      staff,
      trucks,
      auditLog,
      backups,
    ]) {
      await tx.delete(table);
    }
    await tx.update(settings).set({ nextChallanNo: 1 });
  });
  await seedSampleIfEmpty(db);
}

/**
 * Local demo / E2E only (`SEED_DEMO=1`, never the practice desk or the live desk): one login per
 * role, all with the same password, linked to the sample staff so the driver sees only their trip.
 * admin · neha (office) · ramesh (driver) · kishan (helper).
 */
export async function seedDemoLogins(db: Database, password: string): Promise<void> {
  const [existing] = await db.select({ id: users.id }).from(users).limit(1);
  if (existing) return;
  const { hashPassword } = await import("@/lib/password");
  const passwordHash = await hashPassword(password);
  const [people, roleRows] = await Promise.all([
    db.select({ id: staff.id, name: staff.name }).from(staff),
    db.select({ id: roles.id, key: roles.key }).from(roles),
  ]);
  const staffId = (name: string) => people.find((p) => p.name === name)?.id ?? null;
  const roleId = (key: string) => roleRows.find((r) => r.key === key)?.id;
  const logins = [
    { login: "admin", name: "Admin", role: "admin", staffId: null },
    { login: "neha", name: "Neha Desai", role: "office", staffId: staffId("Neha Desai") },
    { login: "ramesh", name: "Ramesh Yadav", role: "driver", staffId: staffId("Ramesh Yadav") },
    { login: "kishan", name: "Kishan Rathod", role: "helper", staffId: staffId("Kishan Rathod") },
  ] as const;
  await db.transaction(async (tx) => {
    for (const l of logins) {
      const [user] = await tx
        .insert(users)
        .values({
          login: l.login,
          name: l.name,
          staffId: l.staffId,
          passwordHash,
          mustChangePassword: false,
        })
        .returning({ id: users.id });
      const role = roleId(l.role);
      if (user && role) await tx.insert(userRoles).values({ userId: user.id, roleId: role });
    }
  });
}
