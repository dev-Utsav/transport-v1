"use server";

import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";

import { istDay } from "@/lib/dates";
import { zf } from "@/lib/form";
import { TRIP_ACTION_TO } from "@/lib/flow";
import { PAY_MODES } from "@/lib/types";
import { logChange } from "@/server/audit";
import { getDb } from "@/server/db";
import { challans, payments, trips } from "@/server/db/schema";
import { assertCan, tripScope } from "@/server/auth";
import { refreshDesk } from "@/server/guard";

/** Puts waiting parcels (booked, on no truck) on a truck that is still loading. */
export async function loadOnTrip(formData: FormData): Promise<void> {
  await assertCan("trips.load");
  const tripId = zf.id.parse(formData.get("tripId"));
  const ids = z.array(z.coerce.number().int().positive()).max(500).parse(formData.getAll("ids"));
  const db = await getDb();
  if (ids.length) {
    await db.transaction(async (tx) => {
      const [trip] = await tx
        .select({ status: trips.status })
        .from(trips)
        .where(eq(trips.id, tripId));
      if (trip?.status !== "loading") return;
      const loaded = await tx
        .update(challans)
        .set({ tripId, status: "loaded" })
        .where(
          and(
            inArray(challans.id, ids),
            isNull(challans.tripId),
            eq(challans.status, "booked"),
            eq(challans.isCancelled, false),
          ),
        )
        .returning({ id: challans.id });
      for (const c of loaded)
        await logChange(
          tx,
          "challan",
          c.id,
          "update",
          { tripId: null, status: "booked" },
          { tripId, status: "loaded" },
        );
    });
  }
  refreshDesk();
  redirect(`/trips/${tripId}`, RedirectType.replace);
}

/** Takes a parcel back off a truck that hasn't left yet. */
export async function unloadFromTrip(formData: FormData): Promise<void> {
  await assertCan("trips.load");
  const id = zf.id.parse(formData.get("id"));
  const db = await getDb();
  let tripId: number | null = null;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ tripId: challans.tripId, tripStatus: trips.status })
      .from(challans)
      .innerJoin(trips, eq(trips.id, challans.tripId))
      .where(eq(challans.id, id));
    if (!row || row.tripStatus !== "loading") return;
    tripId = row.tripId;
    await tx.update(challans).set({ tripId: null, status: "booked" }).where(eq(challans.id, id));
    await logChange(
      tx,
      "challan",
      id,
      "update",
      { tripId: row.tripId, status: "loaded" },
      { tripId: null, status: "booked" },
    );
  });
  refreshDesk();
  redirect(tripId ? `/trips/${tripId}` : `/challans/${id}`, RedirectType.replace);
}

/**
 * The trip's one next action: dispatch (everything on it goes on the road), arrive, or close.
 * Only moves forward from the expected status, so a double tap does nothing.
 */
export async function advanceTrip(formData: FormData): Promise<void> {
  const actor = await assertCan("trips.advance");
  const { id, action } = z
    .object({ id: zf.id, action: z.enum(["dispatch", "arrive", "close"]) })
    .parse({ id: formData.get("id"), action: formData.get("action") });
  const from = { dispatch: "loading", arrive: "in_transit", close: "arrived" } as const;
  const to = TRIP_ACTION_TO[action];
  const scope = tripScope(actor);
  const db = await getDb();
  await db.transaction(async (tx) => {
    // An empty truck can't leave: load first (the screen says so; this is the server's check).
    if (action === "dispatch") {
      const [onTruck] = await tx
        .select({ id: challans.id })
        .from(challans)
        .where(and(eq(challans.tripId, id), eq(challans.isCancelled, false)))
        .limit(1);
      if (!onTruck) return;
    }
    const moved = await tx
      .update(trips)
      // Arrival day is what on-time scores are measured by.
      .set(action === "arrive" ? { status: to, arrivedOn: istDay() } : { status: to })
      .where(
        and(
          eq(trips.id, id),
          eq(trips.status, from[action]),
          // A driver moves only their own truck.
          scope === null ? undefined : eq(trips.driverId, scope),
        ),
      )
      .returning({ id: trips.id });
    if (!moved.length) return;
    await logChange(tx, "trip", id, "update", { status: from[action] }, { status: to });
    if (action === "dispatch") {
      await tx
        .update(challans)
        .set({ status: "in_transit" })
        .where(
          and(
            eq(challans.tripId, id),
            eq(challans.isCancelled, false),
            ne(challans.status, "delivered"),
          ),
        );
    }
  });
  refreshDesk();
  redirect(`/trips/${id}`, RedirectType.replace);
}

/**
 * Marks a parcel delivered. With a mode, also records the money still due on it as received
 * from the party who owes it (To-Pay is collected on delivery).
 */
export async function deliverChallan(formData: FormData): Promise<void> {
  const actor = await assertCan("trips.deliver");
  const scope = tripScope(actor);
  const { id, mode, back } = z
    .object({
      id: zf.id,
      mode: z.enum(PAY_MODES).optional().catch(undefined),
      back: z
        .string()
        .regex(/^\/[^/]/)
        .optional()
        .catch(undefined),
    })
    .parse({
      id: formData.get("id"),
      mode: formData.get("mode") ?? undefined,
      back: formData.get("back") ?? undefined,
    });
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(challans).where(eq(challans.id, id));
    if (!c || c.isCancelled) return;
    if (scope !== null) {
      // A driver delivers only parcels on their own trip.
      const [trip] = c.tripId
        ? await tx.select({ driverId: trips.driverId }).from(trips).where(eq(trips.id, c.tripId))
        : [];
      if (trip?.driverId !== scope) throw new Error("Not allowed");
    }
    if (c.status !== "delivered") {
      await tx.update(challans).set({ status: "delivered" }).where(eq(challans.id, id));
      await logChange(tx, "challan", id, "update", { status: c.status }, { status: "delivered" });
    }
    if (!mode) return;
    const [paid] = await tx
      .select({ sum: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(Number) })
      .from(payments)
      .where(and(eq(payments.challanId, id), eq(payments.isCancelled, false)));
    const due = c.total - (paid?.sum ?? 0);
    if (due <= 0) return;
    const [p] = await tx
      .insert(payments)
      .values({
        vendorId: c.partyId,
        challanId: id,
        amount: due,
        mode,
        paidOn: istDay(),
        note: "On delivery",
      })
      .returning();
    if (p) await logChange(tx, "payment", p.id, "create", null, p);
  });
  refreshDesk();
  redirect(back ?? `/challans/${id}`, RedirectType.replace);
}
