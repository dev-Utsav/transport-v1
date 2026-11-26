import type { Metadata } from "next";
import { IntentLink } from "@/components/ui/IntentLink";

import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/PageHead";
import type { Permission } from "@/lib/access";
import { can, requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";

export const metadata: Metadata = { title: "New" };

/** The tab bar's + button: the everyday entries this person may make, one tap each. */
export default async function NewPage() {
  const actor = await requireAccess("challans.book");
  const t = await getT();
  const items = (
    [
      { href: "/challans/new", label: t.home.newChallan, icon: "receipt", need: "challans.book" },
      { href: "/trips/new", label: t.home.newTrip, icon: "truck", need: "trips.manage" },
      {
        href: "/payments/new",
        label: t.home.recordPayment,
        icon: "rupee",
        need: "payments.record",
      },
      { href: "/expenses/new", label: t.home.addExpense, icon: "wallet", need: "expenses.record" },
      {
        href: "/salary/advances",
        label: t.salary.giveAdvance,
        icon: "idCard",
        need: "advances.record",
      },
      { href: "/vendors/new", label: t.vendors.new, icon: "users", need: "parties.manage" },
    ] satisfies { href: string; label: string; icon: IconName; need: Permission }[]
  ).filter((item) => can(actor, item.need));
  return (
    <>
      <PageHead title={t.nav.new} />
      <ul className="grid gap-3">
        {items.map((item, i) => (
          <li key={item.href}>
            <IntentLink
              href={item.href}
              className={`flex min-h-20 items-center gap-4 rounded-card px-5 text-[19px] font-bold shadow-card ${i === 0 ? "bg-signal text-card" : "bg-card ring-1 ring-rule hover:ring-rule-strong"}`}
            >
              <Icon name={item.icon} size={28} className={i === 0 ? "" : "text-signal"} />
              {item.label}
            </IntentLink>
          </li>
        ))}
      </ul>
    </>
  );
}
