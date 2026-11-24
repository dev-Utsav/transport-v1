import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { advanceTrip, deliverChallan, loadOnTrip } from "@/server/actions/flow";
import { getActor, tripScope } from "@/server/auth";
import { challans, trips } from "@/server/db/schema";
import { getTripDetail, listTrips } from "@/server/queries/trips";
import { setupTestDb } from "@/tests/fixtures/db";
import {
  bookChallan,
  expectRedirect,
  form,
  makeStaff,
  makeTrip,
  signInAs,
} from "@/tests/fixtures/factories";

const testDb = setupTestDb();

/** Two trips: one driven by Ramesh, one by Suresh, each with an arrived parcel. */
async function twoTrips() {
  const { db } = testDb();
  const ramesh = await makeStaff(db, { name: "Ramesh" });
  const suresh = await makeStaff(db, { name: "Suresh" });
  const mine = await makeTrip(db, { driverId: ramesh.id, status: "arrived" });
  const other = await makeTrip(db, { driverId: suresh.id, status: "arrived" });
  const myParcel = await bookChallan(db, { tripId: mine.id });
  const otherParcel = await bookChallan(db, { tripId: other.id });
  return { db, ramesh, mine, other, myParcel, otherParcel };
}

describe("a driver sees and works only their own trips", () => {
  it("lists and opens only trips they drive", async () => {
    const { db, ramesh, mine, other } = await twoTrips();
    await signInAs(db, "driver", { staffId: ramesh.id });
    const actor = await getActor();
    if (!actor) throw new Error("not signed in");
    const scope = tripScope(actor);
    expect(scope).toBe(ramesh.id);
    expect((await listTrips("open", scope)).map((t) => t.id)).toEqual([mine.id]);
    expect(await getTripDetail(other.id, scope)).toBeNull();
    expect((await getTripDetail(mine.id, scope))?.trip.id).toBe(mine.id);
  });

  it("can deliver a parcel on their trip, not on someone else's", async () => {
    const { db, ramesh, myParcel, otherParcel } = await twoTrips();
    await signInAs(db, "driver", { staffId: ramesh.id });
    await expectRedirect(() => deliverChallan(form({ id: myParcel, mode: "cash" })));
    await expect(deliverChallan(form({ id: otherParcel, mode: "cash" }))).rejects.toThrow(
      "Not allowed",
    );
    const rows = await db.select().from(challans);
    expect(rows.find((c) => c.id === myParcel)?.status).toBe("delivered");
    expect(rows.find((c) => c.id === otherParcel)?.status).not.toBe("delivered");
  });

  it("moving someone else's truck does nothing", async () => {
    const { db, ramesh, other } = await twoTrips();
    await signInAs(db, "driver", { staffId: ramesh.id });
    await expectRedirect(() => advanceTrip(form({ id: other.id, action: "close" })));
    const [row] = await db.select().from(trips).where(eq(trips.id, other.id));
    expect(row?.status).toBe("arrived");
  });

  it("a driver login without a staff link sees no trips at all", async () => {
    const { db } = await twoTrips();
    await signInAs(db, "driver");
    const actor = await getActor();
    if (!actor) throw new Error("not signed in");
    expect(await listTrips("open", tripScope(actor))).toEqual([]);
  });
});

describe("helpers load, but don't deliver or take money", () => {
  it("can load a parcel on any truck, can't deliver", async () => {
    const { db } = testDb();
    const loading = await makeTrip(db, { status: "loading" });
    const parcel = await bookChallan(db);
    await signInAs(db, "helper");
    const actor = await getActor();
    expect(actor && tripScope(actor)).toBeNull();
    await expectRedirect(() => loadOnTrip(form({ ids: parcel, tripId: loading.id })));
    await expect(deliverChallan(form({ id: parcel, mode: "cash" }))).rejects.toThrow("Not allowed");
  });
});
