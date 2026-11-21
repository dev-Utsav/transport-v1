"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { failed, formValues, zf } from "@/lib/form";
import type { FormState } from "@/lib/form";
import { parseRate, splitGst } from "@/lib/gst";
import { CHALLAN_STATUSES, GST_MODES, PAY_MODES, PAY_TYPES } from "@/lib/types";
import { logChange } from "@/server/audit";
import type { Tx } from "@/server/db";
import { getDb } from "@/server/db";
import { challans, payments, settings, trips, vendors } from "@/server/db/schema";
import { assertAdmin, refreshDesk } from "@/server/guard";

/** A party picker: an existing id, or "new" with a name (and phone) typed in place. */
const partyPick = z.union([z.literal("new"), z.coerce.number().int().positive()]);

const challanSchema = z
  .object({
    tripId: zf.optionalId,
    bookedOn: zf.day,
    senderId: partyPick,
    senderNewName: z.string().trim().max(200).default(""),
    senderNewPhone: zf.phone,
    receiverId: partyPick,
    receiverNewName: z.string().trim().max(200).default(""),
    receiverNewPhone: zf.phone,
    fromPlace: zf.text,
    toPlace: zf.text,
    packages: z.coerce.number().int().min(1).max(100_000),
    description: zf.optionalText,
    weightKg: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : 0))
      .pipe(z.number().int().min(0).max(100_000)),
    freight: zf.positiveMoney,
    payType: z.enum(PAY_TYPES),
    payNowMode: z.enum(PAY_MODES).optional(),
    gstMode: z.enum(GST_MODES),
    gstRate: z.string().default("0"),
  })
  .superRefine((c, ctx) => {
    if (c.senderId === "new" && !c.senderNewName)
      ctx.addIssue({ code: "custom", path: ["senderNewName"], message: "required" });
    if (c.receiverId === "new" && !c.receiverNewName)
      ctx.addIssue({ code: "custom", path: ["receiverNewName"], message: "required" });
    if (c.payType === "paid" && !c.payNowMode)
      ctx.addIssue({ code: "custom", path: ["payNowMode"], message: "required" });
    if (c.gstMode !== "none" && parseRate(c.gstRate) === null)
      ctx.addIssue({ code: "custom", path: ["gstRate"], message: "invalid" });
  });

/** Which step of the New challan form holds each field, to reopen it on an error. */
const STEP_OF: Record<string, number> = {
  tripId: 0,
  bookedOn: 0,
  senderId: 0,
  senderNewName: 0,
  senderNewPhone: 0,
  receiverId: 0,
  receiverNewName: 0,
  receiverNewPhone: 0,
  fromPlace: 1,
  toPlace: 1,
  packages: 1,
  description: 1,
  weightKg: 1,
  freight: 2,
  payType: 2,
  payNowMode: 2,
  gstMode: 2,
  gstRate: 2,
};

async function resolveParty(
  tx: Tx,
  pick: number | "new",
  name: string,
  phone: string,
  kind: "sender" | "receiver",
): Promise<number> {
  if (pick !== "new") return pick;
  const [created] = await tx.insert(vendors).values({ name, phone, kind }).returning();
  if (!created) throw new Error("Insert failed");
  await logChange(tx, "vendor", created.id, "create", null, created);
  return created.id;
}

export async function createChallan(_prev: FormState, formData: FormData): Promise<FormState> {
  await assertAdmin();
  const values = formValues(formData);
  const parsed = challanSchema.safeParse(values);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.path.join(".") ?? "";
    return failed(parsed.error, values, STEP_OF[first] ?? 0);
  }
  const c = parsed.data;
  const rateBp = c.gstMode === "none" ? 0 : (parseRate(c.gstRate) ?? 0);
  const gst = splitGst(c.freight, c.gstMode, rateBp);
  const db = await getDb();

  const id = await db.transaction(async (tx) => {
    const senderId = await resolveParty(
      tx,
      c.senderId,
      c.senderNewName,
      c.senderNewPhone,
      "sender",
    );
    const receiverId = await resolveParty(
      tx,
      c.receiverId,
      c.receiverNewName,
      c.receiverNewPhone,
      "receiver",
    );
    // The settings row lock makes numbering safe even with two saves at the same moment.
    const [counter] = await tx
      .update(settings)
      .set({ nextChallanNo: sql`${settings.nextChallanNo} + 1` })
      .where(eq(settings.id, 1))
      .returning({ next: settings.nextChallanNo });
    if (!counter) throw new Error("Settings row missing");
    if (c.tripId) {
      const [trip] = await tx.select({ id: trips.id }).from(trips).where(eq(trips.id, c.tripId));
      if (!trip) throw new Error("Trip not found");
    }
    const [created] = await tx
      .insert(challans)
      .values({
        no: counter.next - 1,
        bookedOn: c.bookedOn,
        tripId: c.tripId,
        senderId,
        receiverId,
        partyId: c.payType === "to_pay" ? receiverId : senderId,
        fromPlace: c.fromPlace,
        toPlace: c.toPlace,
        packages: c.packages,
        description: c.description,
        weightKg: c.weightKg,
        freight: c.freight,
        gstMode: c.gstMode,
        gstRateBp: rateBp,
        ...gst,
        payType: c.payType,
        status: c.tripId ? "loaded" : "booked",
      })
      .returning();
    if (!created) throw new Error("Insert failed");
    await logChange(tx, "challan", created.id, "create", null, created);
    if (c.payType === "paid" && c.payNowMode) {
      const [payment] = await tx
        .insert(payments)
        .values({
          vendorId: senderId,
          challanId: created.id,
          amount: gst.total,
          mode: c.payNowMode,
          paidOn: c.bookedOn,
        })
        .returning();
      if (payment) await logChange(tx, "payment", payment.id, "create", null, payment);
    }
    return created.id;
  });
  refreshDesk();
  redirect(`/challans/${id}?saved=1`);
}

const editSchema = z.object({
  id: zf.id,
  tripId: zf.optionalId,
  fromPlace: zf.text,
  toPlace: zf.text,
  packages: z.coerce.number().int().min(1).max(100_000),
  description: zf.optionalText,
  weightKg: z.coerce.number().int().min(0).max(100_000),
});

/** Goods and trip can be corrected; money can't (cancel and book again, so the ledger stays true). */
export async function editChallan(_prev: FormState, formData: FormData): Promise<FormState> {
  await assertAdmin();
  const values = formValues(formData);
  const parsed = editSchema.safeParse(values);
  if (!parsed.success) return failed(parsed.error, values);
  const { id, ...data } = parsed.data;
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(challans).where(eq(challans.id, id));
    if (!before || before.isCancelled) throw new Error("Challan not editable");
    const [after] = await tx.update(challans).set(data).where(eq(challans.id, id)).returning();
    await logChange(tx, "challan", id, "update", before, after);
  });
  refreshDesk();
  redirect(`/challans/${id}`);
}

export async function setChallanStatus(formData: FormData): Promise<void> {
  await assertAdmin();
  const { id, status } = z
    .object({ id: zf.id, status: z.enum(CHALLAN_STATUSES) })
    .parse({ id: formData.get("id"), status: formData.get("status") });
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(challans).where(eq(challans.id, id));
    if (!before || before.isCancelled || before.status === status) return;
    await tx.update(challans).set({ status }).where(eq(challans.id, id));
    await logChange(tx, "challan", id, "update", { status: before.status }, { status });
  });
  refreshDesk();
}

/** Cancels the challan and any payment recorded against it, in one go. */
export async function cancelChallan(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = zf.id.parse(formData.get("id"));
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(challans).where(eq(challans.id, id));
    if (!before || before.isCancelled) return;
    await tx.update(challans).set({ isCancelled: true }).where(eq(challans.id, id));
    await logChange(tx, "challan", id, "cancel", before, { isCancelled: true });
    const linked = await tx
      .update(payments)
      .set({ isCancelled: true })
      .where(and(eq(payments.challanId, id), eq(payments.isCancelled, false)))
      .returning({ id: payments.id });
    for (const p of linked)
      await logChange(tx, "payment", p.id, "cancel", null, {
        isCancelled: true,
        reason: `challan ${id}`,
      });
  });
  refreshDesk();
  redirect(`/challans/${id}`);
}
