import type { Metadata } from "next";
import { IntentLink } from "@/components/ui/IntentLink";

import { ReportActions } from "@/components/domain/ReportActions";
import { ReportTable } from "@/components/domain/ReportTable";
import { PageHead } from "@/components/ui/PageHead";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { Empty } from "@/components/ui/Rows";
import { formatDay, formatMonth, istMonth, isMonth, shiftMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { tripProfit } from "@/server/queries/reports";

export const metadata: Metadata = { title: "Trip profit" };

export default async function TripProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAccess("reports.view");
  const { month: m = "" } = await searchParams;
  const thisMonth = istMonth();
  const month = isMonth(m) ? m : thisMonth;
  const [t, rows] = await Promise.all([getT(), tripProfit(month)]);
  const sum = (key: "freight" | "spent" | "profit") => rows.reduce((s, r) => s + r[key], 0);
  return (
    <>
      <PageHead
        back={{ href: "/reports", label: t.reports.title }}
        title={t.reports.tripProfit}
        actions={<ReportActions t={t} csvHref={`/api/export/trip-profit?month=${month}`} />}
      />
      <div className="grid gap-6">
        <PeriodNav
          label={formatMonth(month)}
          prevHref={`/reports/trip-profit?month=${shiftMonth(month, -1)}`}
          nextHref={month < thisMonth ? `/reports/trip-profit?month=${shiftMonth(month, 1)}` : null}
          prevLabel={t.common.prev}
          nextLabel={t.common.nextPeriod}
        />
        {rows.length ? (
          <ReportTable
            columns={[
              { label: t.common.date },
              { label: t.trips.truck },
              { label: t.trips.route },
              { label: t.trips.freight, align: "right" },
              { label: t.trips.expenses, align: "right" },
              { label: t.trips.profit, align: "right" },
            ]}
            rows={rows.map((r) => ({
              key: r.id,
              cells: [
                formatDay(r.departOn),
                <IntentLink key="t" href={`/trips/${r.id}`} className="font-mono hover:underline">
                  {r.truckNumber}
                </IntentLink>,
                `${r.fromPlace} → ${r.toPlace}`,
                <span key="f" className="num">
                  {formatMoney(r.freight)}
                </span>,
                <span key="s" className="num">
                  {formatMoney(r.spent)}
                </span>,
                <span
                  key="p"
                  className={`num font-semibold ${r.profit < 0 ? "text-due" : "text-in"}`}
                >
                  {formatMoney(r.profit)}
                </span>,
              ],
            }))}
            foot={[
              t.common.total,
              "",
              "",
              formatMoney(sum("freight")),
              formatMoney(sum("spent")),
              formatMoney(sum("profit")),
            ]}
          />
        ) : (
          <Empty>{t.common.nothing}</Empty>
        )}
      </div>
    </>
  );
}
