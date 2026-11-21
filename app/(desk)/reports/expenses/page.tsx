import type { Metadata } from "next";

import { ReportActions } from "@/components/domain/ReportActions";
import { ReportTable } from "@/components/domain/ReportTable";
import { PageHead, Section } from "@/components/ui/PageHead";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { categoryLabel } from "@/content/strings";
import { formatMonth, istMonth, isMonth, shiftMonth } from "@/lib/dates";
import { formatCompact, formatMoney } from "@/lib/money";
import { getT } from "@/server/lang";
import { expenseBreakdown } from "@/server/queries/money";

export const metadata: Metadata = { title: "Expense report" };

export default async function ExpenseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: m = "" } = await searchParams;
  const thisMonth = istMonth();
  const month = isMonth(m) ? m : thisMonth;
  const [t, data] = await Promise.all([getT(), expenseBreakdown(month)]);
  const max = Math.max(1, ...data.byMonth.map((r) => r.amount));
  return (
    <>
      <PageHead
        back={{ href: "/reports", label: t.reports.title }}
        title={t.reports.expense}
        sub={`${t.common.total}: ${formatMoney(data.total)}`}
        actions={<ReportActions t={t} csvHref={`/api/export/expenses?month=${month}`} />}
      />
      <div className="grid gap-8">
        <PeriodNav
          label={formatMonth(month)}
          prevHref={`/reports/expenses?month=${shiftMonth(month, -1)}`}
          nextHref={month < thisMonth ? `/reports/expenses?month=${shiftMonth(month, 1)}` : null}
          prevLabel={t.common.prev}
          nextLabel={t.common.nextPeriod}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title={t.expenses.byCategory}>
            <ReportTable
              wide={false}
              columns={[{ label: t.expenses.category }, { label: t.common.amount, align: "right" }]}
              rows={data.byCategory.map((r) => ({
                key: r.category,
                cells: [
                  categoryLabel(t, r.category),
                  <span key="a" className="num">
                    {formatMoney(r.amount)}
                  </span>,
                ],
              }))}
              foot={[t.common.total, formatMoney(data.total)]}
            />
          </Section>
          <Section title={t.expenses.byTruck}>
            <ReportTable
              wide={false}
              columns={[{ label: t.trips.truck }, { label: t.common.amount, align: "right" }]}
              rows={data.byTruck.map((r) => ({
                key: r.truckNumber ?? "office",
                cells: [
                  <span key="n" className="font-mono">
                    {r.truckNumber ?? "—"}
                  </span>,
                  <span key="a" className="num">
                    {formatMoney(r.amount)}
                  </span>,
                ],
              }))}
            />
          </Section>
        </div>
        <Section title={t.common.month}>
          {/* Six months as plain bars, each with its figure printed: no hover needed to read it. */}
          <ol className="grid grid-cols-6 items-end gap-2 rounded-card bg-card p-4 shadow-card ring-1 ring-rule sm:gap-4 sm:p-6">
            {data.byMonth.map((r) => (
              <li
                key={r.month}
                className="grid h-48 grid-rows-[auto_1fr_auto] items-end gap-1.5 text-center"
              >
                <span className="num text-[12px] font-semibold sm:text-[13px]">
                  {formatCompact(r.amount)}
                </span>
                <span className="flex h-full items-end">
                  <span
                    className={`block w-full rounded-t-md ${r.month === month ? "bg-signal" : "bg-rule-strong"}`}
                    style={{ height: `${Math.max(2, (r.amount / max) * 100)}%` }}
                  />
                </span>
                <span className="text-[12px] text-ink-2">{formatMonth(r.month).slice(0, 3)}</span>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </>
  );
}
