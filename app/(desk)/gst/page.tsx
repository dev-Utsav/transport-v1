import type { Metadata } from "next";
import Link from "next/link";

import { ReportActions } from "@/components/domain/ReportActions";
import { ReportTable } from "@/components/domain/ReportTable";
import { PageHead } from "@/components/ui/PageHead";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { Empty } from "@/components/ui/Rows";
import { Stats } from "@/components/ui/Stats";
import { formatChallanNo } from "@/lib/challan-no";
import { formatDay, formatMonth, istMonth, isMonth, shiftMonth } from "@/lib/dates";
import { formatRate } from "@/lib/gst";
import { formatMoney } from "@/lib/money";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { gstSummary } from "@/server/queries/reports";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "GST summary" };

export default async function GstPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAccess("gst.view");
  const { month: m = "" } = await searchParams;
  const thisMonth = istMonth();
  const month = isMonth(m) ? m : thisMonth;
  const [t, settings, data] = await Promise.all([getT(), getSettings(), gstSummary(month)]);
  return (
    <>
      <PageHead
        title={t.gst.title}
        sub={t.gst.help}
        actions={<ReportActions t={t} csvHref={`/api/export/gst?month=${month}`} />}
      />
      <div className="grid gap-6">
        {settings.gstin ? null : (
          <p className="rounded-field bg-part-soft px-4 py-3 text-[15px] font-semibold text-part">
            {t.gst.noGstin}{" "}
            <Link href="/settings" className="underline">
              {t.nav.settings}
            </Link>
          </p>
        )}
        <PeriodNav
          label={formatMonth(month)}
          prevHref={`/gst?month=${shiftMonth(month, -1)}`}
          nextHref={month < thisMonth ? `/gst?month=${shiftMonth(month, 1)}` : null}
          prevLabel={t.common.prev}
          nextLabel={t.common.nextPeriod}
        />
        <Stats
          items={[
            { label: t.gst.count, value: data.totals.count },
            { label: t.gst.taxable, value: formatMoney(data.totals.taxable) },
            { label: t.gst.tax, value: formatMoney(data.totals.tax) },
            { label: t.common.total, value: formatMoney(data.totals.taxable + data.totals.tax) },
          ]}
        />
        {data.rows.length ? (
          <ReportTable
            columns={[
              { label: t.challans.no },
              { label: t.common.date },
              { label: t.payments.party },
              { label: "GSTIN" },
              { label: "%", align: "right" },
              { label: t.gst.taxable, align: "right" },
              { label: t.gst.tax, align: "right" },
            ]}
            rows={data.rows.map((r) => ({
              key: r.no,
              cells: [
                <span key="n" className="font-mono">
                  {formatChallanNo(r.no, settings.challanPrefix)}
                </span>,
                formatDay(r.bookedOn),
                r.partyName,
                r.partyGstin || "—",
                formatRate(r.rateBp),
                <span key="tx" className="num">
                  {formatMoney(r.taxable)}
                </span>,
                <span key="g" className="num">
                  {formatMoney(r.tax)}
                </span>,
              ],
            }))}
            foot={[
              t.common.total,
              "",
              "",
              "",
              "",
              formatMoney(data.totals.taxable),
              formatMoney(data.totals.tax),
            ]}
          />
        ) : (
          <Empty>{t.common.nothing}</Empty>
        )}
      </div>
    </>
  );
}
