"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { daysInMonth } from "@/lib/dates";
import { failed, formValues, zf } from "@/lib/form";
import type { FormState } from "@/lib/form";
import { calcSalary } from "@/lib/salary";
import { PAY_MODES } from "@/lib/types";
import { logChange } from "@/server/audit";
import { getDb } from "@/server/db";
import { salaryMonths, staff } from "@/server/db/schema";
import { assertCan } from "@/server/auth";
import { guardForm, refreshDesk } from "@/server/guard";

const entrySchema = z
  .object({
    staffId: zf.id,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    present: zf.count,
    absent: zf.count,
    halfDays: zf.count,
    advance: zf.money,
    deduction: zf.money,
    note: zf.optionalText,
    markPaid: z.enum(["yes", "no"]).default("no"),
    paidMode: z.enum(PAY_MODES).optional(),
    paidOn: zf.optionalDay,
  })
  .superRefine((e, ctx) => {
    if (e.present + e.absent + e.halfDays > daysInMonth(e.month)) {
      ctx.addIssue({ code: "custom", path: ["present"], message: "invalid" });
    }
    if (e.markPaid === "yes" && !e.paidMode)
      ctx.addIssue({ code: "custom", path: ["paidMode"], message: "required" });
    if (e.markPaid === "yes" && !e.paidOn)
      ctx.addIssue({ code: "custom", path: ["paidOn"], message: "required" });
  });

/** Saves attendance, advances and deductions; optionally marks the net as paid in the same step. */
export async function saveSalaryEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  return guardForm(formData, async () => {
    await assertCan("salary.manage");
    const values = formValues(formData);
    const parsed = entrySchema.safeParse(values);
    if (!parsed.success) return failed(parsed.error, values);
    const { markPaid, paidMode, paidOn, ...entry } = parsed.data;
    const db = await getDb();
    await db.transaction(async (tx) => {
      const [employee] = await tx.select().from(staff).where(eq(staff.id, entry.staffId));
      if (!employee) throw new Error("Employee not found");
      const [before] = await tx
        .select()
        .from(salaryMonths)
        .where(and(eq(salaryMonths.staffId, entry.staffId), eq(salaryMonths.month, entry.month)));
      // Salary is frozen per month: an existing entry keeps the rate it was made with.
      const monthlySalary = before?.monthlySalary ?? employee.monthlySalary;
      const net = calcSalary({ ...entry, monthlySalary }).net;
      const paid =
        markPaid === "yes" && paidMode && paidOn
          ? { paidMode, paidOn, paidAmount: net }
          : {
              paidMode: before?.paidMode ?? null,
              paidOn: before?.paidOn ?? null,
              paidAmount: before?.paidAmount ?? null,
            };
      const row = { ...entry, monthlySalary, ...paid };
      const [after] = before
        ? await tx.update(salaryMonths).set(row).where(eq(salaryMonths.id, before.id)).returning()
        : await tx.insert(salaryMonths).values(row).returning();
      if (after)
        await logChange(
          tx,
          "salary",
          after.id,
          before ? "update" : "create",
          before ?? null,
          after,
        );
    });
    refreshDesk();
    redirect(`/salary?month=${entry.month}&saved=1`);
  });
}
