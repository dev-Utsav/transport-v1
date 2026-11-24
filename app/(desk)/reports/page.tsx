import type { Metadata } from "next";

import { PageHead } from "@/components/ui/PageHead";
import { RowList, RowLink } from "@/components/ui/Rows";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireAccess("reports.view");
  const t = await getT();
  const reports = [
    { href: "/reports/cash-book", title: t.reports.cashBook, help: t.reports.cashBookHelp },
    { href: "/reports/outstanding", title: t.reports.outstanding, help: t.reports.outstandingHelp },
    { href: "/reports/trip-profit", title: t.reports.tripProfit, help: t.reports.tripProfitHelp },
    { href: "/reports/expenses", title: t.reports.expense, help: t.reports.expenseHelp },
    {
      href: "/salary/register",
      title: t.reports.salaryRegister,
      help: t.reports.salaryRegisterHelp,
    },
    { href: "/gst", title: t.gst.title, help: t.reports.gstHelp },
  ];
  return (
    <>
      <PageHead title={t.reports.title} />
      <RowList>
        {reports.map((r) => (
          <RowLink key={r.href} href={r.href} title={r.title} meta={r.help} />
        ))}
      </RowList>
    </>
  );
}
