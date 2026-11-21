import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/PageHead";
import { getT } from "@/server/lang";

export const metadata: Metadata = { title: "New" };

/** The tab bar's + button: the four everyday entries, one tap each. */
export default async function NewPage() {
  const t = await getT();
  const items: { href: string; label: string; icon: IconName }[] = [
    { href: "/challans/new", label: t.home.newChallan, icon: "receipt" },
    { href: "/trips/new", label: t.home.newTrip, icon: "truck" },
    { href: "/payments/new", label: t.home.recordPayment, icon: "rupee" },
    { href: "/expenses/new", label: t.home.addExpense, icon: "wallet" },
    { href: "/vendors/new", label: t.vendors.new, icon: "users" },
  ];
  return (
    <>
      <PageHead title={t.nav.new} />
      <ul className="grid gap-3">
        {items.map((item, i) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`flex min-h-20 items-center gap-4 rounded-card px-5 text-[19px] font-bold shadow-card ${i === 0 ? "bg-signal text-card" : "bg-card ring-1 ring-rule hover:ring-rule-strong"}`}
            >
              <Icon name={item.icon} size={28} className={i === 0 ? "" : "text-signal"} />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
