"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { failed, formValues, zf } from "@/lib/form";
import type { FormState } from "@/lib/form";
import { EMPLOYEE_ROLES, TRUCK_OWNERS } from "@/lib/types";
import { logChange } from "@/server/audit";
import { getDb } from "@/server/db";
import { drivers, employees, trucks } from "@/server/db/schema";
import { assertAdmin, refreshDesk } from "@/server/guard";

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
  role: z.enum(EMPLOYEE_ROLES),
  monthlySalary: zf.positiveMoney,
  joinedOn: zf.day,
});

export async function saveTruck(_prev: FormState, formData: FormData): Promise<FormState> {
  await assertAdmin();
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
}

export async function saveDriver(_prev: FormState, formData: FormData): Promise<FormState> {
  await assertAdmin();
  const values = formValues(formData);
  const parsed = driverSchema.safeParse(values);
  if (!parsed.success) return failed(parsed.error, values);
  const { id, ...data } = parsed.data;
  const db = await getDb();
  await db.transaction(async (tx) => {
    if (id) {
      const [before] = await tx.select().from(drivers).where(eq(drivers.id, id));
      const [after] = await tx.update(drivers).set(data).where(eq(drivers.id, id)).returning();
      await logChange(tx, "driver", id, "update", before, after);
      return;
    }
    const [created] = await tx.insert(drivers).values(data).returning();
    if (created) await logChange(tx, "driver", created.id, "create", null, created);
  });
  refreshDesk();
  redirect("/settings/drivers");
}

export async function saveEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  await assertAdmin();
  const values = formValues(formData);
  const parsed = employeeSchema.safeParse(values);
  if (!parsed.success) return failed(parsed.error, values);
  const { id, ...data } = parsed.data;
  const db = await getDb();
  await db.transaction(async (tx) => {
    if (id) {
      const [before] = await tx.select().from(employees).where(eq(employees.id, id));
      const [after] = await tx.update(employees).set(data).where(eq(employees.id, id)).returning();
      await logChange(tx, "employee", id, "update", before, after);
      return;
    }
    const [created] = await tx.insert(employees).values(data).returning();
    if (created) await logChange(tx, "employee", created.id, "create", null, created);
  });
  refreshDesk();
  redirect("/salary");
}

const toggleTables = { truck: trucks, driver: drivers, employee: employees } as const;

/** Hide or show a truck, driver or staff member. Nothing is deleted. */
export async function toggleMaster(formData: FormData): Promise<void> {
  await assertAdmin();
  const { kind, id } = z
    .object({ kind: z.enum(["truck", "driver", "employee"]), id: zf.id })
    .parse({ kind: formData.get("kind"), id: formData.get("id") });
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
    await logChange(tx, kind, id, "update", before, after);
  });
  refreshDesk();
}
