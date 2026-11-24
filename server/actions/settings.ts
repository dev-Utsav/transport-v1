"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { failed, formValues, zf } from "@/lib/form";
import type { FormState } from "@/lib/form";
import { parseRate } from "@/lib/gst";
import { GST_MODES } from "@/lib/types";
import { logChange } from "@/server/audit";
import { getDb } from "@/server/db";
import { settings } from "@/server/db/schema";
import { assertCan } from "@/server/auth";
import { refreshDesk } from "@/server/guard";

const settingsSchema = z.object({
  businessName: zf.optionalText,
  address: zf.optionalText,
  phone: zf.phone,
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^$|^[0-9]{2}[A-Z0-9]{13}$/)
    .default(""),
  gstMode: z.enum(GST_MODES),
  gstRate: z.string().transform((v, ctx) => {
    const bp = parseRate(v);
    if (bp === null) {
      ctx.addIssue({ code: "custom", message: "invalid" });
      return z.NEVER;
    }
    return bp;
  }),
  challanPrefix: z.string().trim().max(12).default(""),
  nextChallanNo: z.coerce.number().int().min(1).max(9_999_999),
  openingCash: zf.money,
  reminderDays: z.coerce.number().int().min(1).max(365),
});

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await assertCan("settings.manage");
  const values = formValues(formData);
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) return failed(parsed.error, values);
  const { gstRate, ...rest } = parsed.data;
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(settings).where(eq(settings.id, 1));
    if (!before) throw new Error("Settings row missing");
    // Numbers only move forward: a lower "next" would reuse printed challan numbers.
    if (rest.nextChallanNo < before.nextChallanNo) return "backwards" as const;
    const [after] = await tx
      .update(settings)
      .set({ ...rest, gstRateBp: gstRate })
      .where(eq(settings.id, 1))
      .returning();
    await logChange(tx, "settings", 1, "update", before, after);
    return "ok" as const;
  });
  if (result === "backwards") return { ok: false, errors: { nextChallanNo: "invalid" }, values };
  refreshDesk();
  redirect("/settings?saved=1");
}

export async function addCategory(formData: FormData): Promise<void> {
  await assertCan("settings.manage");
  const name = z.string().trim().min(1).max(40).safeParse(formData.get("category"));
  if (!name.success) return;
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(settings).where(eq(settings.id, 1));
    if (!before || before.expenseCategories.includes(name.data)) return;
    const expenseCategories = [...before.expenseCategories, name.data];
    await tx.update(settings).set({ expenseCategories }).where(eq(settings.id, 1));
    await logChange(
      tx,
      "settings",
      1,
      "update",
      { expenseCategories: before.expenseCategories },
      { expenseCategories },
    );
  });
  refreshDesk();
}
