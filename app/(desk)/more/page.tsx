import type { Metadata } from "next";
import Link from "next/link";

import { TourEntry } from "@/components/domain/TourEntry";
import { mainNav } from "@/components/layout/nav";
import { Icon } from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/PageHead";
import { logout } from "@/server/actions/session";
import { env } from "@/server/env";
import { getT } from "@/server/lang";

export const metadata: Metadata = { title: "More" };

/** Phone only in practice: everything not in the tab bar, as big rows. */
export default async function MorePage() {
  const t = await getT();
  const items = mainNav(t).filter((i) => !["/", "/trips", "/vendors"].includes(i.href));
  return (
    <>
      <PageHead title={t.nav.more} />
      <div className="mb-6">
        <TourEntry t={t} />
      </div>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex min-h-16 items-center gap-4 rounded-card bg-card px-5 text-[17px] font-semibold shadow-card ring-1 ring-rule hover:ring-rule-strong"
            >
              <Icon name={item.icon} size={24} className="text-signal" />
              <span className="flex-1">{item.label}</span>
              <Icon name="chevronRight" size={18} className="text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
      {env.APP_PASSWORD ? (
        <form action={logout} className="mt-8">
          <button className="flex min-h-12 items-center gap-3 px-2 text-[16px] font-semibold text-ink-2">
            <Icon name="logout" size={20} />
            {t.nav.logout}
          </button>
        </form>
      ) : null}
    </>
  );
}
