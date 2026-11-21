import "server-only";

import { and, asc, desc, eq, lte, or, sql } from "drizzle-orm";

import { monthRange } from "@/lib/dates";
import { calcSalary } from "@/lib/salary";
import { getDb } from "@/server/db";
import { employees, salaryMonths } from "@/server/db/schema";

/**
 * Everyone who worked that month (joined by its last day; hidden staff only if they have an
 * entry), with the month's entry if one exists and the computed pay.
 */
export async function salaryRegister(month: string) {
  const db = await getDb();
  const { to } = monthRange(month);
  const rows = await db
    .select({ employee: employees, entry: salaryMonths })
    .from(employees)
    .leftJoin(
      salaryMonths,
      and(eq(salaryMonths.employeeId, employees.id), eq(salaryMonths.month, month)),
    )
    .where(
      and(
        lte(employees.joinedOn, to),
        or(eq(employees.isActive, true), sql`${salaryMonths.id} is not null`),
      ),
    )
    .orderBy(desc(employees.isActive), asc(employees.name));
  return rows.map(({ employee, entry }) => {
    const pay = entry ? calcSalary({ ...entry, month }) : null;
    return { employee, entry, pay };
  });
}

export async function getEmployee(id: number) {
  const db = await getDb();
  const [row] = await db.select().from(employees).where(eq(employees.id, id));
  return row ?? null;
}

export async function getSalaryEntry(employeeId: number, month: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(salaryMonths)
    .where(and(eq(salaryMonths.employeeId, employeeId), eq(salaryMonths.month, month)));
  return row ?? null;
}
