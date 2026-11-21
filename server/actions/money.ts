"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { failed, formValues, zf } from "@/lib/form";
import type { FormState } from "@/lib/form";
import { sniffImage } from "@/lib/image";
import { PAY_MODES } from "@/lib/types";
import { logChange } from "@/server/audit";
import { getDb } from "@/server/db";
import { billPhotos, challans, expenses, payments } from "@/server/db/schema";
import { assertAdmin, refreshDesk } from "@/server/guard";

const MAX_PHOTO_BYTES = 1_500_000;

const paymentSchema = z.object({
  vendorId: zf.id,
  challanId: zf.optionalId,
  amount: zf.positiveMoney,
  mode: z.enum(PAY_MODES),
  paidOn: zf.day,
  note: zf.optionalText,
  back: z
    .string()
    .regex(/^\/[^/]/)
    .optional()
    .catch(undefined),
});

export async function recordPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  await assertAdmin();
  const values = formValues(formData);
  const parsed = paymentSchema.safeParse(values);
  if (!parsed.success) return failed(parsed.error, values);
  const { back, ...data } = parsed.data;
  const db = await getDb();
  if (data.challanId) {
    // A payment against a challan must come from the party who owes it.
    const [owner] = await db
      .select({ partyId: challans.partyId })
      .from(challans)
      .where(and(eq(challans.id, data.challanId), eq(challans.isCancelled, false)));
    if (owner?.partyId !== data.vendorId)
      return { ok: false, errors: { challanId: "invalid" }, values };
  }
  const paymentId = await db.transaction(async (tx) => {
    const [created] = await tx.insert(payments).values(data).returning();
    if (!created) throw new Error("Insert failed");
    await logChange(tx, "payment", created.id, "create", null, created);
    return created.id;
  });
  refreshDesk();
  // Back on the party's page, which offers the WhatsApp receipt for this payment.
  redirect(back ?? `/vendors/${data.vendorId}?saved=1&payment=${paymentId}`);
}

export async function cancelPayment(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = zf.id.parse(formData.get("id"));
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(payments).where(eq(payments.id, id));
    if (!before || before.isCancelled) return;
    await tx.update(payments).set({ isCancelled: true }).where(eq(payments.id, id));
    await logChange(tx, "payment", id, "cancel", before, { isCancelled: true });
  });
  refreshDesk();
}

const expenseSchema = z.object({
  spentOn: zf.day,
  amount: zf.positiveMoney,
  category: zf.text,
  mode: z.enum(PAY_MODES),
  truckId: zf.optionalId,
  tripId: zf.optionalId,
  note: zf.optionalText,
});

export async function addExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  await assertAdmin();
  const values = formValues(formData);
  const parsed = expenseSchema.safeParse(values);
  if (!parsed.success) return failed(parsed.error, values);

  const file = formData.get("photo");
  let photo: { mime: string; data: Buffer } | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PHOTO_BYTES) return { ok: false, errors: { photo: "invalid" }, values };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImage(bytes);
    if (!mime) return { ok: false, errors: { photo: "invalid" }, values };
    photo = { mime, data: Buffer.from(bytes) };
  }
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(expenses)
      .values({ ...parsed.data, hasPhoto: photo !== null })
      .returning();
    if (!created) throw new Error("Insert failed");
    if (photo) await tx.insert(billPhotos).values({ expenseId: created.id, ...photo });
    await logChange(tx, "expense", created.id, "create", null, created);
  });
  refreshDesk();
  redirect(`/expenses?month=${parsed.data.spentOn.slice(0, 7)}&saved=1`);
}

export async function cancelExpense(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = zf.id.parse(formData.get("id"));
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(expenses).where(eq(expenses.id, id));
    if (!before || before.isCancelled) return;
    await tx.update(expenses).set({ isCancelled: true }).where(eq(expenses.id, id));
    await logChange(tx, "expense", id, "cancel", before, { isCancelled: true });
  });
  refreshDesk();
}
