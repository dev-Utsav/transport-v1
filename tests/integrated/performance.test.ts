import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { istDay, shiftDay } from "@/lib/dates";
import { EMPTY_FORM } from "@/lib/form";
import { giveAdvance } from "@/server/actions/advances";
import { advanceTrip } from "@/server/actions/flow";
import { setTripStatus } from "@/server/actions/trips";
import { trips } from "@/server/db/schema";
import { moneyOverview, partyScorecard, tripScorecards } from "@/server/queries/performance";
import { cashBook } from "@/server/queries/reports";
import { setupTestDb } from "@/tests/fixtures/db";
import { recordPayment } from "@/server/actions/money";
import {
  bookChallan,
  expectRedirect,
  form,
  makeParty,
  makeStaff,
  makeTrip,
  makeTruck,
} from "@/tests/fixtures/factories";

const testDb = setupTestDb();
const today = istDay();

describe("arrival day", () => {
  it("is set when the truck arrives and cleared if the status is moved back", async () => {
    const { db } = testDb();
    const trip = await makeTrip(db, { status: "in_transit" });
    await setTripStatus(form({ id: trip.id, status: "arrived" }));
    let [row] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(row?.arrivedOn).toBe(today);
    await setTripStatus(form({ id: trip.id, status: "in_transit" }));
    [row] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(row?.arrivedOn).toBeNull();
  });
});

describe("trip buttons", () => {
  it("won't send off an empty truck", async () => {
    const { db } = testDb();
    const trip = await makeTrip(db);
    await expectRedirect(() => advanceTrip(form({ id: trip.id, action: "dispatch" })));
    const [row] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(row?.status).toBe("loading");
  });

  it("records the arrival day when the big button marks the truck arrived", async () => {
    const { db } = testDb();
    const trip = await makeTrip(db, { status: "in_transit" });
    await expectRedirect(() => advanceTrip(form({ id: trip.id, action: "arrive" })));
    const [row] = await db.select().from(trips).where(eq(trips.id, trip.id));
    expect(row).toMatchObject({ status: "arrived", arrivedOn: today });
  });
});

describe("scorecards", () => {
  it("ranks drivers and hired owners by on-time arrival", async () => {
    const { db } = testDb();
    const ontime = await makeStaff(db, { name: "Ontime" });
    const late = await makeStaff(db, { name: "Late" });
    const hired = await makeTruck(db, { owner: "hired", ownerName: "Patel Roadlines" });
    const day = shiftDay(today, -5);
    await makeTrip(db, {
      driverId: ontime.id,
      truckId: hired.id,
      departOn: day,
      expectedOn: shiftDay(day, 2),
      arrivedOn: shiftDay(day, 2),
      status: "arrived",
    });
    await makeTrip(db, {
      driverId: late.id,
      departOn: day,
      expectedOn: shiftDay(day, 1),
      arrivedOn: shiftDay(day, 4),
      status: "arrived",
    });
    const cards = await tripScorecards(shiftDay(today, -30));
    expect(cards.drivers.map((d) => d.name)).toEqual(["Ontime", "Late"]);
    expect(cards.drivers[1]).toMatchObject({ measured: 1, onTime: 0, avgLateDays: 3 });
    expect(cards.owners).toHaveLength(1);
    expect(cards.owners[0]).toMatchObject({ name: "Patel Roadlines", trips: 1, onTime: 1 });
    expect(cards.trucks).toHaveLength(2);
  });

  it("puts the party who pays above the one who doesn't", async () => {
    const { db } = testDb();
    const good = await makeParty(db, { name: "Pays" });
    const bad = await makeParty(db, { name: "Owes" });
    await bookChallan(db, { senderId: good.id, payType: "billed" });
    await bookChallan(db, { senderId: bad.id, payType: "billed" });
    await expectRedirect(() =>
      recordPayment(
        EMPTY_FORM,
        form({ vendorId: good.id, amount: "5000", mode: "upi", paidOn: today }),
      ),
    );
    const rows = await partyScorecard(shiftDay(today, -89), today);
    const names = rows.map((p) => p.name);
    expect(names.indexOf("Pays")).toBeLessThan(names.indexOf("Owes"));
    expect(rows.find((p) => p.name === "Pays")).toMatchObject({ pays: 1, balance: 0 });
    expect(rows.find((p) => p.name === "Owes")).toMatchObject({ pays: 0, oldestDueDays: 0 });
  });
});

describe("money with advances", () => {
  it("counts cash advances as money out and in the cash book", async () => {
    const { db } = testDb();
    const worker = await makeStaff(db, {
      onPayroll: true,
      monthlySalary: 1500000,
      joinedOn: "2025-01-01",
    });
    await expectRedirect(() =>
      giveAdvance(EMPTY_FORM, form({ staffId: worker.id, amount: "300", mode: "cash", givenOn: today })),
    );
    const book = await cashBook(today);
    expect(book.cashOut).toBe(30000);
    expect(book.advs).toHaveLength(1);
    expect((await cashBook(shiftDay(today, 1))).opening).toBe(book.closing);
    const money = await moneyOverview(today.slice(0, 7));
    expect(money).toMatchObject({ advances: 30000, moneyOut: 30000 });
    expect(money.trend.at(-1)).toMatchObject({ out: 30000 });
  });
});
