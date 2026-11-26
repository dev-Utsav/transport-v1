import type { Metadata } from "next";

import { PageHead, Section } from "@/components/ui/PageHead";
import { RowList, RowLink } from "@/components/ui/Rows";
import { can, requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";

export const metadata: Metadata = { title: "Reports" };

/** Two groups, so the right report is one glance away: where the money is, and who is doing well. */
export default async function ReportsPage() {
  const actor = await requireAccess("reports.view");
  const t = await getT();
  const r = t.reports;
  const money = [
    { href: "/reports/money", title: r.money, help: r.moneyHelp },
    { href: "/reports/cash-book", title: r.cashBook, help: r.cashBookHelp },
    { href: "/reports/outstanding", title: r.outstanding, help: r.outstandingHelp },
    { href: "/reports/expenses", title: r.expense, help: r.expenseHelp },
    ...(can(actor, "salary.view")
      ? [{ href: "/salary/register", title: r.salaryRegister, help: r.salaryRegisterHelp }]
      : []),
    { href: "/gst", title: t.gst.title, help: r.gstHelp },
  ];
  const people = [
    ...(can(actor, "parties.view")
      ? [{ href: "/reports/parties", title: r.parties, help: r.partiesHelp }]
      : []),
    { href: "/reports/performance", title: r.performance, help: r.performanceHelp },
    { href: "/reports/trip-profit", title: r.tripProfit, help: r.tripProfitHelp },
  ];
  return (
    <>
      <PageHead title={r.title} />
      <div className="grid gap-8">
        {[
          { title: r.groupMoney, items: money },
          { title: r.groupPeople, items: people },
        ].map((group) => (
          <Section key={group.title} title={group.title}>
            <RowList>
              {group.items.map((item) => (
                <RowLink key={item.href} href={item.href} title={item.title} meta={item.help} />
              ))}
            </RowList>
          </Section>
        ))}
      </div>
    </>
  );
}
