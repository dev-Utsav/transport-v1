import type { Metadata } from "next";
import { IntentLink } from "@/components/ui/IntentLink";

import { TourEntry } from "@/components/domain/TourEntry";
import { allowedNav, mainNav } from "@/components/layout/nav";
import { Icon } from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/PageHead";
import { requireAccess } from "@/server/auth";
import { logout } from "@/server/actions/session";
import { getT } from "@/server/lang";

export const metadata: Metadata = { title: "More" };

/** Phone only in practice: everything not in the tab bar, as big rows. */
export default async function MorePage({
  searchParams,
}: {
  searchParams: Promise<{ practice?: string }>;
}) {
  const actor = await requireAccess();
  const [t, { practice }] = await Promise.all([getT(), searchParams]);
  const items = [
    ...allowedNav(mainNav(t), actor.permissions).filter(
      (i) => !["/", "/trips", "/vendors"].includes(i.href),
    ),
    { href: "/account/password", label: t.settings.account, icon: "settings" as const, need: [] },
  ];
  return (
    <>
      <PageHead title={t.nav.more} />
      <div className="mb-6">
        <TourEntry t={t} from="/more" failed={practice === "failed"} />
      </div>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <IntentLink
              href={item.href}
              className="flex min-h-16 items-center gap-4 rounded-card bg-card px-5 text-[17px] font-semibold shadow-card ring-1 ring-rule hover:ring-rule-strong"
            >
              <Icon name={item.icon} size={24} className="text-signal" />
              <span className="flex-1">{item.label}</span>
              <Icon name="chevronRight" size={18} className="text-ink-3" />
            </IntentLink>
          </li>
        ))}
      </ul>
      <form action={logout} className="mt-8">
        <button className="flex min-h-12 items-center gap-3 px-2 text-[16px] font-semibold text-ink-2">
          <Icon name="logout" size={20} />
          {t.nav.logout}
        </button>
      </form>
    </>
  );
}
