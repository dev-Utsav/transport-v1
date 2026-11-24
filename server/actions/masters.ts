"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { failed, formValues, zf } from "@/lib/form";
import type { FormState } from "@/lib/form";
import { STAFF_ROLES, TRUCK_OWNERS } from "@/lib/types";
import { logChange } from "@/server/audit";
import { getDb } from "@/server/db";
import { staff, trucks } from "@/server/db/schema";
import { assertCan } from "@/server/auth";
import { guardForm, refreshDesk } from "@/server/guard";

const truckSchema = z.object({
  id: zf.optionalId,
  // "GJ 06 AB 1234" → "GJ06AB1234" so search and uniqueness don't depend on spacing.
  number: zf.text.transform((v) => v.toUpperCase().replace(/[\s-]/g, "")),
  type: zf.optionalText,
  owner: z.enum(TRUCK_OWNERS),
  ownerName: zf.optionalText,
});

const driverSchema = z.object({
  id: zf.optionalId,
  name: zf.text,
  phone: zf.phone,
  licence: zf.optionalText.transform((v) => v.toUpperCase()),
});

const employeeSchema = z.object({
  id: zf.optionalId,
  name: zf.text,
  phone: zf.phone,
  role: z.enum(STAFF_ROLES),
  monthlySalary: zf.positiveMoney,
  joinedOn: zf.day,
});

export async function saveTruck(_prev: FormState, formData: FormData): Promise<FormState> {
  return guardForm(formData, async () => {
    await assertCan("masters.manage");
    const values = formValues(formData);
    const parsed = truckSchema.safeParse(values);
    if (!parsed.success) return failed(parsed.error, values);
    const { id, ...data } = parsed.data;
    const db = await getDb();
    const [clash] = await db
      .select({ id: trucks.id })
      .from(trucks)
      .where(eq(trucks.number, data.number));
    if (clash && clash.id !== id) return { ok: false, errors: { number: "invalid" }, values };
    await db.transaction(async (tx) => {
      if (id) {
        const [before] = await tx.select().from(trucks).where(eq(trucks.id, id));
        const [after] = await tx.update(trucks).set(data).where(eq(trucks.id, id)).returning();
        await logChange(tx, "truck", id, "update", before, after);
        return;
      }
      const [created] = await tx.insert(trucks).values(data).returning();
      if (created) await logChange(tx, "truck", created.id, "create", null, created);
    });
    refreshDesk();
    redirect("/settings/trucks");
  });
}

/** Settings → Drivers: a driver's name, phone and licence. New ones start off payroll. */
export async function saveDriver(_prev: FormState, formData: FormData): Promise<FormState> {
  return guardForm(formData, async () => {
    await assertCan("masters.manage");
    const values = formValues(formData);
    const parsed = driverSchema.safeParse(values);
    if (!parsed.success) return failed(parsed.error, values);
    const { id, ...data } = parsed.data;
    const db = await getDb();
    await db.transaction(async (tx) => {
      if (id) {
        const [before] = await tx.select().from(staff).where(eq(staff.id, id));
        const [after] = await tx.update(staff).set(data).where(eq(staff.id, id)).returning();
        await logChange(tx, "staff", id, "update", before, after);
        return;
      }
      const [created] = await tx
        .insert(staff)
        .values({ ...data, role: "driver", onPayroll: false })
        .returning();
      if (created) await logChange(tx, "staff", created.id, "create", null, created);
    });
    refreshDesk();
    redirect("/settings/drivers");
  });
}

/** Salary → staff: anyone on salary. Saving puts them on payroll (also a driver added earlier). */
export async function saveEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  return guardForm(formData, async () => {
    await assertCan("salary.manage");
    const values = formValues(formData);
    const parsed = employeeSchema.safeParse(values);
    if (!parsed.success) return failed(parsed.error, values);
    const { id, ...fields } = parsed.data;
    const data = { ...fields, onPayroll: true };
    const db = await getDb();
    const staffId = await db.transaction(async (tx) => {
      if (id) {
        const [before] = await tx.select().from(staff).where(eq(staff.id, id));
        const [after] = await tx.update(staff).set(data).where(eq(staff.id, id)).returning();
        await logChange(tx, "staff", id, "update", before, after);
        return id;
      }
      const [created] = await tx.insert(staff).values(data).returning();
      if (!created) throw new Error("Insert failed");
      await logChange(tx, "staff", created.id, "create", null, created);
      return created.id;
    });
    refreshDesk();
    redirect(id ? `/salary/${staffId}` : "/salary");
  });
}

const toggleTables = { truck: trucks, driver: staff, employee: staff } as const;

/** Hide or show a truck or a staff member (driver / employee screens). Nothing is deleted. */
export async function toggleMaster(formData: FormData): Promise<void> {
  const { kind, id } = z
    .object({ kind: z.enum(["truck", "driver", "employee"]), id: zf.id })
    .parse({ kind: formData.get("kind"), id: formData.get("id") });
  // Staff on salary are hidden from the Salary screens; trucks and drivers from Settings.
  await assertCan(kind === "employee" ? "salary.manage" : "masters.manage");
  const table = toggleTables[kind];
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(table).where(eq(table.id, id));
    if (!before) return;
    const [after] = await tx
      .update(table)
      .set({ isActive: !before.isActive })
      .where(eq(table.id, id))
      .returning();
    await logChange(tx, kind === "truck" ? "truck" : "staff", id, "update", before, after);
  });
  refreshDesk();
}
