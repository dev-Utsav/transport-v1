"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { failed, formValues, zf } from "@/lib/form";
import type { FormState } from "@/lib/form";
import { VENDOR_KINDS } from "@/lib/types";
import { logChange } from "@/server/audit";
import { getDb } from "@/server/db";
import { vendors } from "@/server/db/schema";
import { assertCan } from "@/server/auth";
import { guardForm, refreshDesk } from "@/server/guard";

const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^$|^[0-9]{2}[A-Z0-9]{13}$/)
  .default("");

const vendorSchema = z.object({
  id: zf.optionalId,
  name: zf.text,
  phone: zf.phone,
  address: zf.optionalText,
  gstin,
  kind: z.enum(VENDOR_KINDS),
  openingBalance: zf.money,
  back: z
    .string()
    .regex(/^\/[^/]/)
    .optional()
    .catch(undefined),
});

export async function saveVendor(_prev: FormState, formData: FormData): Promise<FormState> {
  return guardForm(formData, async () => {
    await assertCan("parties.manage");
    const values = formValues(formData);
    const parsed = vendorSchema.safeParse(values);
    if (!parsed.success) return failed(parsed.error, values);
    const { id, back, ...data } = parsed.data;
    const db = await getDb();
    const savedId = await db.transaction(async (tx) => {
      if (id) {
        const [before] = await tx.select().from(vendors).where(eq(vendors.id, id));
        if (!before) throw new Error("Vendor not found");
        const [after] = await tx.update(vendors).set(data).where(eq(vendors.id, id)).returning();
        await logChange(tx, "vendor", id, "update", before, after);
        return id;
      }
      const [created] = await tx.insert(vendors).values(data).returning();
      if (!created) throw new Error("Insert failed");
      await logChange(tx, "vendor", created.id, "create", null, created);
      return created.id;
    });
    refreshDesk();
    redirect(back ?? `/vendors/${savedId}`);
  });
}

export async function toggleVendor(formData: FormData): Promise<void> {
  await assertCan("parties.manage");
  const id = zf.id.parse(formData.get("id"));
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(vendors).where(eq(vendors.id, id));
    if (!before) return;
    const [after] = await tx
      .update(vendors)
      .set({ isActive: !before.isActive })
      .where(eq(vendors.id, id))
      .returning();
    await logChange(tx, "vendor", id, "update", before, after);
  });
  refreshDesk();
}
