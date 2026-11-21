import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SalaryForm } from "@/components/forms/SalaryForm";
import { ButtonLink } from "@/components/ui/Button";
import { PageHead } from "@/components/ui/PageHead";
import { Pill } from "@/components/ui/Pill";
import { daysInMonth, formatDay, formatMonth, istDay, istMonth, isMonth } from "@/lib/dates";
import { formatMoney, paiseToInput } from "@/lib/money";
import { getT } from "@/server/lang";
import { getEmployee, getSalaryEntry } from "@/server/queries/salary";

export const metadata: Metadata = { title: "Salary entry" };

export default async function SalaryEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const id = Number((await params).id);
  const { month: m = "" } = await searchParams;
  const month = isMonth(m) ? m : istMonth();
  const [t, employee, entry] = await Promise.all([
    getT(),
    getEmployee(id),
    getSalaryEntry(id, month),
  ]);
  if (!employee) notFound();
  return (
    <>
      <PageHead
        back={{ href: `/salary?month=${month}`, label: t.salary.title }}
        title={employee.name}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {t.roles[employee.role]} · {formatMonth(month)}
            {entry?.paidOn && entry.paidMode ? (
              <Pill tone="in">
                {t.salary.paid} · {formatMoney(entry.paidAmount ?? 0)} · {t.modes[entry.paidMode]} ·{" "}
                {formatDay(entry.paidOn)}
              </Pill>
            ) : null}
          </span>
        }
        actions={
          <>
            {entry ? (
              <ButtonLink
                href={`/salary/${id}/slip?month=${month}`}
                variant="secondary"
                icon="print"
              >
                {t.salary.slip}
              </ButtonLink>
            ) : null}
            <ButtonLink href={`/salary/staff/${id}`} variant="secondary">
              {t.common.edit}
            </ButtonLink>
          </>
        }
      />
      <SalaryForm
        t={{ common: t.common, salary: t.salary, modes: t.modes }}
        monthlySalary={entry?.monthlySalary ?? employee.monthlySalary}
        month={month}
        isPaid={Boolean(entry?.paidOn)}
        initial={{
          employeeId: String(id),
          present: String(entry?.present ?? daysInMonth(month)),
          absent: String(entry?.absent ?? 0),
          halfDays: String(entry?.halfDays ?? 0),
          advance: paiseToInput(entry?.advance ?? 0),
          deduction: paiseToInput(entry?.deduction ?? 0),
          note: entry?.note ?? "",
          paidOn: istDay(),
        }}
      />
    </>
  );
}
