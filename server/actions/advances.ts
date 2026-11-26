"use server";

import { and, eq, gte, isNotNull } from "drizzle-orm";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";

import { failed, formValues, zf } from "@/lib/form";
import type { FormState } from "@/lib/form";
import { PAY_MODES } from "@/lib/types";
import { logChange } from "@/server/audit";
import { assertCan } from "@/server/auth";
import { getDb } from "@/server/db";
import { salaryMonths, staff, staffAdvances } from "@/server/db/schema";
import { guardForm, refreshDesk } from "@/server/guard";

const advanceSchema = z.object({
  staffId: zf.id,
  amount: zf.positiveMoney,
  mode: z.enum(PAY_MODES),
  givenOn: zf.day,
  note: zf.optionalText,
  // Where to come back to: the quick-entry list (default) or the person's salary page.
  back: z
    .string()
    .regex(/^\/salary(\/|\?|$)/)
    .optional()
    .catch(undefined),
});

/**
 * Cash advance to a worker. Many a day, so the save comes back to the same screen ready for
 * the next one. Taken off their salary automatically (see `advanceOwedFor`).
 */
export async function giveAdvance(_prev: FormState, formData: FormData): Promise<FormState> {
  return guardForm(formData, async () => {
    await assertCan("advances.record");
    const values = formValues(formData);
    const parsed = advanceSchema.safeParse(values);
    if (!parsed.success) return failed(parsed.error, values);
    const { back, ...data } = parsed.data;
    const db = await getDb();
    const saved = await db.transaction(async (tx) => {
      const [employee] = await tx
        .select({ id: staff.id })
        .from(staff)
        .where(
          and(eq(staff.id, data.staffId), eq(staff.onPayroll, true), eq(staff.isActive, true)),
        );
      if (!employee) return null;
      const [row] = await tx.insert(staffAdvances).values(data).returning();
      if (row) await logChange(tx, "advance", row.id, "create", null, row);
      return row?.id ?? null;
    });
    if (!saved) return { ok: false, errors: { staffId: "invalid" }, values };
    refreshDesk();
    // `saved` carries the new id, so the screen remounts an empty form for the next advance.
    redirect(back ?? `/salary/advances?day=${data.givenOn}&saved=${saved}`, RedirectType.replace);
  });
}

/**
 * Cancels an advance (it stays visible, leaves every total). Refused once a salary from that
 * month on is paid: the paid slip already counted it, so the khata would no longer add up.
 */
export async function cancelAdvance(formData: FormData): Promise<void> {
  await assertCan("advances.cancel");
  const id = zf.id.parse(formData.get("id"));
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(staffAdvances).where(eq(staffAdvances.id, id));
    if (!before || before.isCancelled) return;
    const [paidLater] = await tx
      .select({ id: salaryMonths.id })
      .from(salaryMonths)
      .where(
        and(
          eq(salaryMonths.staffId, before.staffId),
          gte(salaryMonths.month, before.givenOn.slice(0, 7)),
          isNotNull(salaryMonths.paidOn),
        ),
      )
      .limit(1);
    if (paidLater) return;
    await tx.update(staffAdvances).set({ isCancelled: true }).where(eq(staffAdvances.id, id));
    await logChange(tx, "advance", id, "cancel", before, { isCancelled: true });
  });
  refreshDesk();
}
