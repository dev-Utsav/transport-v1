import type { Metadata } from "next";

import { Letterhead, Paper } from "@/components/domain/Paper";
import { PageHead } from "@/components/ui/PageHead";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatDay, formatMonth, istMonth, isMonth } from "@/lib/dates";
import { formatAmount } from "@/lib/money";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { salaryRegister } from "@/server/queries/salary";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Salary register" };

export default async function SalaryRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAccess("salary.view");
  const { month: m = "" } = await searchParams;
  const month = isMonth(m) ? m : istMonth();
  const [t, settings, rows] = await Promise.all([getT(), getSettings(), salaryRegister(month)]);
  const withPay = rows.filter((r) => r.pay && r.entry);
  const total = withPay.reduce((s, r) => s + (r.pay?.net ?? 0), 0);
  return (
    <>
      <PageHead
        back={{ href: `/salary?month=${month}`, label: t.salary.title }}
        title={t.salary.register}
        actions={<PrintButton label={t.common.print} />}
      />
      <Paper>
        <Letterhead
          settings={settings}
          title={`${t.salary.register} · ${formatMonth(month)}`}
          fallbackName={t.app.name}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b-2 border-ink uppercase">
                <th className="py-2 pr-2">{t.common.name}</th>
                <th className="py-2 pr-2">{t.salary.role}</th>
                <th className="py-2 pr-2 text-right">{t.salary.monthly}</th>
                <th className="py-2 pr-2 text-right">{t.salary.paidDays}</th>
                <th className="py-2 pr-2 text-right">{t.salary.earned}</th>
                <th className="py-2 pr-2 text-right">{t.salary.advance}</th>
                <th className="py-2 pr-2 text-right">{t.salary.deduction}</th>
                <th className="py-2 pr-2 text-right">{t.salary.net}</th>
                <th className="py-2">{t.salary.paidOn}</th>
              </tr>
            </thead>
            <tbody>
              {withPay.map(({ employee, entry, pay }) =>
                entry && pay ? (
                  <tr key={employee.id} className="border-b border-rule">
                    <td className="py-2 pr-2 font-semibold">{employee.name}</td>
                    <td className="py-2 pr-2">{t.roles[employee.role]}</td>
                    <td className="py-2 pr-2 text-right">{formatAmount(entry.monthlySalary)}</td>
                    <td className="py-2 pr-2 text-right">
                      {pay.paidDays}/{pay.totalDays}
                    </td>
                    <td className="py-2 pr-2 text-right">{formatAmount(pay.earned)}</td>
                    <td className="py-2 pr-2 text-right">{formatAmount(pay.advanceCut)}</td>
                    <td className="py-2 pr-2 text-right">{formatAmount(entry.deduction)}</td>
                    <td className="py-2 pr-2 text-right font-semibold">{formatAmount(pay.net)}</td>
                    <td className="py-2">
                      {entry.paidOn && entry.paidMode
                        ? `${formatDay(entry.paidOn)} · ${t.modes[entry.paidMode]}`
                        : "—"}
                    </td>
                  </tr>
                ) : null,
              )}
            </tbody>
            <tfoot>
              <tr className="text-[15px] font-bold">
                <td colSpan={7} className="pt-3 text-right">
                  {t.common.total}
                </td>
                <td className="pt-3 text-right">{formatAmount(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Paper>
    </>
  );
}
