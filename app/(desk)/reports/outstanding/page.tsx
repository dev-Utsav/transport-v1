import type { Metadata } from "next";
import { IntentLink } from "@/components/ui/IntentLink";

import { ReportActions } from "@/components/domain/ReportActions";
import { ReportTable } from "@/components/domain/ReportTable";
import { PageHead } from "@/components/ui/PageHead";
import { Empty } from "@/components/ui/Rows";
import { formatMoney } from "@/lib/money";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { listVendorBalances } from "@/server/queries/vendors";

export const metadata: Metadata = { title: "Party outstanding" };

export default async function OutstandingPage() {
  await requireAccess("reports.view");
  const [t, rows] = await Promise.all([getT(), listVendorBalances({ dueOnly: true })]);
  const total = rows.reduce((s, r) => s + r.balance, 0);
  return (
    <>
      <PageHead
        back={{ href: "/reports", label: t.reports.title }}
        title={t.reports.outstanding}
        sub={`${t.common.total}: ${formatMoney(total)}`}
        actions={<ReportActions t={t} csvHref="/api/export/outstanding" />}
      />
      {rows.length ? (
        <ReportTable
          columns={[
            { label: t.common.name },
            { label: t.common.phone },
            { label: t.vendors.business, align: "right" },
            { label: t.vendors.received, align: "right" },
            { label: t.vendors.pending, align: "right" },
          ]}
          rows={rows.map((r) => ({
            key: r.id,
            cells: [
              <IntentLink key="n" href={`/vendors/${r.id}`} className="font-semibold hover:underline">
                {r.name}
              </IntentLink>,
              r.phone || "—",
              <span key="b" className="num">
                {formatMoney(r.business + r.openingBalance)}
              </span>,
              <span key="r" className="num">
                {formatMoney(r.received)}
              </span>,
              <span key="p" className="num font-semibold text-due">
                {formatMoney(r.balance)}
              </span>,
            ],
          }))}
          foot={[t.common.total, "", "", "", formatMoney(total)]}
        />
      ) : (
        <Empty>{t.home.overdueEmpty}</Empty>
      )}
    </>
  );
}
