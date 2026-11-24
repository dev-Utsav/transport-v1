import "server-only";

import { and, asc, desc, eq, lte, or, sql } from "drizzle-orm";

import { monthRange } from "@/lib/dates";
import { calcSalary } from "@/lib/salary";
import { getDb } from "@/server/db";
import { salaryMonths, staff } from "@/server/db/schema";

/**
 * Everyone on payroll that month (joined by its last day; hidden or off-payroll staff only if
 * they have an entry), with the month's entry if one exists and the computed pay.
 */
export async function salaryRegister(month: string) {
  const db = await getDb();
  const { to } = monthRange(month);
  const rows = await db
    .select({ employee: staff, entry: salaryMonths })
    .from(staff)
    .leftJoin(salaryMonths, and(eq(salaryMonths.staffId, staff.id), eq(salaryMonths.month, month)))
    .where(
      and(
        lte(staff.joinedOn, to),
        or(
          and(eq(staff.onPayroll, true), eq(staff.isActive, true)),
          sql`${salaryMonths.id} is not null`,
        ),
      ),
    )
    .orderBy(desc(staff.isActive), asc(staff.name));
  return rows.map(({ employee, entry }) => {
    const pay = entry ? calcSalary({ ...entry, month }) : null;
    return { employee, entry, pay };
  });
}

export async function getEmployee(id: number) {
  const db = await getDb();
  const [row] = await db.select().from(staff).where(eq(staff.id, id));
  return row ?? null;
}

/** Active drivers not on salary yet (added in Settings → Drivers), to put on payroll. */
export async function driversOffPayroll() {
  const db = await getDb();
  return db
    .select({ id: staff.id, name: staff.name, phone: staff.phone })
    .from(staff)
    .where(and(eq(staff.role, "driver"), eq(staff.onPayroll, false), eq(staff.isActive, true)))
    .orderBy(asc(staff.name));
}

export async function getSalaryEntry(staffId: number, month: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(salaryMonths)
    .where(and(eq(salaryMonths.staffId, staffId), eq(salaryMonths.month, month)));
  return row ?? null;
}
