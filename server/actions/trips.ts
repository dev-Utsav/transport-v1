"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { failed, formValues, zf } from "@/lib/form";
import type { FormState } from "@/lib/form";
import { TRIP_STATUSES } from "@/lib/types";
import type { ChallanStatus, TripStatus } from "@/lib/types";
import { logChange } from "@/server/audit";
import { getDb } from "@/server/db";
import { challans, trips } from "@/server/db/schema";
import { assertCan } from "@/server/auth";
import { refreshDesk } from "@/server/guard";

const tripSchema = z
  .object({
    id: zf.optionalId,
    truckId: zf.id,
    driverId: zf.optionalId,
    fromPlace: zf.text,
    toPlace: zf.text,
    departOn: zf.day,
    expectedOn: zf.optionalDay,
    note: zf.optionalText,
    // A booked parcel to put on the new trip straight away ("Start a new trip with it").
    challanId: zf.optionalId,
  })
  .refine((t) => !t.expectedOn || t.expectedOn >= t.departOn, {
    path: ["expectedOn"],
    message: "invalid",
  });

export async function saveTrip(_prev: FormState, formData: FormData): Promise<FormState> {
  await assertCan("trips.manage");
  const values = formValues(formData);
  const parsed = tripSchema.safeParse(values);
  if (!parsed.success) return failed(parsed.error, values);
  const { id, challanId, ...data } = parsed.data;
  const db = await getDb();
  const savedId = await db.transaction(async (tx) => {
    if (id) {
      const [before] = await tx.select().from(trips).where(eq(trips.id, id));
      if (!before) throw new Error("Trip not found");
      const [after] = await tx.update(trips).set(data).where(eq(trips.id, id)).returning();
      await logChange(tx, "trip", id, "update", before, after);
      return id;
    }
    const [created] = await tx.insert(trips).values(data).returning();
    if (!created) throw new Error("Insert failed");
    await logChange(tx, "trip", created.id, "create", null, created);
    if (challanId) {
      const loaded = await tx
        .update(challans)
        .set({ tripId: created.id, status: "loaded" })
        .where(
          and(
            eq(challans.id, challanId),
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
          { tripId: null },
          { tripId: created.id, status: "loaded" },
        );
    }
    return created.id;
  });
  refreshDesk();
  redirect(`/trips/${savedId}`);
}

/**
 * When the truck leaves, everything loaded on it is in transit too; the admin only marks
 * each challan delivered. Challans already delivered are left alone.
 */
const CASCADE: Partial<Record<TripStatus, { to: ChallanStatus; from: ChallanStatus[] }>> = {
  loading: { to: "loaded", from: ["booked"] },
  in_transit: { to: "in_transit", from: ["booked", "loaded"] },
};

export async function setTripStatus(formData: FormData): Promise<void> {
  await assertCan("trips.manage");
  const { id, status } = z
    .object({ id: zf.id, status: z.enum(TRIP_STATUSES) })
    .parse({ id: formData.get("id"), status: formData.get("status") });
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(trips).where(eq(trips.id, id));
    if (!before || before.status === status) return;
    const [after] = await tx.update(trips).set({ status }).where(eq(trips.id, id)).returning();
    await logChange(tx, "trip", id, "update", { status: before.status }, { status: after?.status });
    const rule = CASCADE[status];
    if (rule) {
      await tx
        .update(challans)
        .set({ status: rule.to })
        .where(
          and(
            eq(challans.tripId, id),
            eq(challans.isCancelled, false),
            inArray(challans.status, rule.from),
          ),
        );
    }
  });
  refreshDesk();
}
