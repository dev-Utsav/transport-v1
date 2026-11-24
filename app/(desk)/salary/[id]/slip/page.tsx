import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Letterhead, Paper } from "@/components/domain/Paper";
import { PageHead } from "@/components/ui/PageHead";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatDayFull, formatMonth, istMonth, isMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { calcSalary } from "@/lib/salary";
import { amountInWords } from "@/lib/words";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { getEmployee, getSalaryEntry } from "@/server/queries/salary";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Salary slip" };

export default async function SalarySlipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAccess("salary.view");
  const id = Number((await params).id);
  const { month: m = "" } = await searchParams;
  const month = isMonth(m) ? m : istMonth();
  const [t, settings, employee, entry] = await Promise.all([
    getT(),
    getSettings(),
    getEmployee(id),
    getSalaryEntry(id, month),
  ]);
  if (!employee || !entry) notFound();
  const pay = calcSalary({ ...entry, month });
  const lines = [
    { label: t.salary.monthly, value: formatMoney(entry.monthlySalary) },
    {
      label: `${t.salary.present} / ${t.salary.absent} / ${t.salary.half}`,
      value: `${entry.present} / ${entry.absent} / ${entry.halfDays}`,
    },
    {
      label: `${t.salary.paidDays} (${pay.paidDays} / ${pay.totalDays})`,
      value: formatMoney(pay.earned),
    },
    { label: `− ${t.salary.advance}`, value: formatMoney(entry.advance) },
    { label: `− ${t.salary.deduction}`, value: formatMoney(entry.deduction) },
  ];
  return (
    <>
      <PageHead
        back={{ href: `/salary/${id}?month=${month}`, label: employee.name }}
        title={t.salary.slip}
        actions={<PrintButton label={t.common.print} />}
      />
      <Paper>
        <Letterhead
          settings={settings}
          title={`${t.salary.slip} · ${formatMonth(month)}`}
          fallbackName={t.app.name}
        />
        <div className="mt-4 grid grid-cols-2 gap-4 border-b border-rule-strong pb-4">
          <div>
            <p className="text-[12px] font-semibold uppercase">{t.common.name}</p>
            <p className="text-[17px] font-bold">{employee.name}</p>
            <p>{t.roles[employee.role]}</p>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-semibold uppercase">{t.salary.joined}</p>
            <p>{employee.joinedOn ? formatDayFull(employee.joinedOn) : "—"}</p>
          </div>
        </div>
        <table className="mt-4 w-full border-collapse">
          <tbody>
            {lines.map((l) => (
              <tr key={l.label} className="border-b border-rule">
                <td className="py-2.5">{l.label}</td>
                <td className="num py-2.5 text-right">{l.value}</td>
              </tr>
            ))}
            <tr className="text-[18px] font-bold">
              <td className="pt-3">{t.salary.net}</td>
              <td className="num pt-3 text-right">{formatMoney(pay.net)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-right italic">{amountInWords(pay.net)}</p>
        {entry.paidOn && entry.paidMode ? (
          <p className="mt-4">
            {t.salary.paid}: {formatMoney(entry.paidAmount ?? pay.net)} · {t.modes[entry.paidMode]}{" "}
            · {formatDayFull(entry.paidOn)}
          </p>
        ) : null}
        {entry.note ? <p className="mt-2">{entry.note}</p> : null}
        <footer className="mt-16 grid grid-cols-2 gap-10 text-center">
          <p className="border-t border-ink pt-2">{employee.name}</p>
          <p className="border-t border-ink pt-2">{settings.businessName || t.app.name}</p>
        </footer>
      </Paper>
    </>
  );
}
