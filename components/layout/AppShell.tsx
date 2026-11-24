import Link from "next/link";
import type { ReactNode } from "react";

import { LangSwitch } from "@/components/layout/LangSwitch";
import { allowedNav, mainNav, tabNav } from "@/components/layout/nav";
import { NavLink } from "@/components/layout/NavLink";
import { TourHost } from "@/components/tour/TourHost";
import { Icon } from "@/components/ui/Icon";
import type { Lang, Strings } from "@/content/strings";
import type { Permission } from "@/lib/access";
import { leavePractice, resetPractice } from "@/server/actions/practice";
import { logout } from "@/server/actions/session";

const MORE_PATHS = [
  "/more",
  "/challans",
  "/expenses",
  "/salary",
  "/gst",
  "/reports",
  "/settings",
] as const;

/**
 * Desktop: fixed sidebar with every section. Phone: compact top bar + bottom tab bar
 * (Home, Trips, New, Parties, More) sized for thumbs. Everything here is server-rendered;
 * only NavLink is a client island.
 */
export function AppShell({
  t,
  lang,
  businessName,
  permissions,
  isPractice,
  children,
}: {
  t: Strings;
  lang: Lang;
  businessName: string;
  permissions: ReadonlySet<Permission>;
  isPractice: boolean;
  children: ReactNode;
}) {
  const tabs = tabNav(t);
  const side = allowedNav(mainNav(t), permissions);
  const left = allowedNav(tabs.left, permissions);
  const right = allowedNav(tabs.right, permissions);
  const canBook = permissions.has("challans.book");
  const home = permissions.has("challans.view") ? "/" : "/trips";
  const title = businessName || t.app.name;
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <a
        href="#main"
        className="sr-only z-50 rounded-field bg-signal px-4 py-3 font-semibold text-card focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t.nav.skip}
      </a>

      <aside
        data-chrome
        className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-rule bg-paper px-4 py-6 lg:flex"
      >
        <Link href={home} className="flex items-center gap-3 rounded-field px-2">
          <Mark />
          <span className="grid leading-tight">
            <span className="text-[16px] font-bold tracking-tight">{title}</span>
            <span className="text-[13px] text-ink-2">{t.app.office}</span>
          </span>
        </Link>
        <nav aria-label={t.nav.home} className="grid gap-1">
          {side.map(({ need: _need, ...item }) => (
            <NavLink key={item.href} {...item} variant="side" />
          ))}
        </nav>
        <div className="mt-auto grid gap-3">
          <LangSwitch lang={lang} label={t.common.language} />
          <form action={logout}>
            <button className="flex min-h-11 w-full items-center gap-3 rounded-field px-3 text-[15px] font-semibold text-ink-2 hover:bg-paper-deep hover:text-ink">
              <Icon name="logout" size={20} />
              {t.nav.logout}
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        {isPractice ? <PracticeBanner t={t} /> : null}
        <header
          data-chrome
          className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-rule bg-paper/95 px-4 py-2.5 backdrop-blur lg:hidden"
        >
          <Link href={home} className="flex min-w-0 items-center gap-2.5">
            <Mark />
            <span className="truncate text-[16px] font-bold tracking-tight">{title}</span>
          </Link>
          <div className="w-40 shrink-0">
            <LangSwitch lang={lang} label={t.common.language} />
          </div>
        </header>

        <main
          id="main"
          data-print-root
          className="mx-auto w-full max-w-[1080px] px-4 pt-5 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16"
        >
          {children}
        </main>
        <TourHost t={t.tour} isPractice={isPractice} />

        <nav
          data-chrome
          aria-label={t.nav.more}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          <div className="mx-auto flex max-w-lg items-stretch px-1">
            {left.map(({ need: _need, ...item }) => (
              <NavLink key={item.href} {...item} variant="tab" />
            ))}
            {canBook ? (
              <div className="flex flex-1 items-center justify-center">
                <Link
                  href="/new"
                  aria-label={t.nav.new}
                  className="-mt-5 flex size-15 items-center justify-center rounded-full bg-signal text-card shadow-lift ring-4 ring-paper transition-transform duration-150 active:scale-95"
                >
                  <Icon name="plus" size={28} />
                </Link>
              </div>
            ) : null}
            {right.map(({ need: _need, ...item }) => (
              <NavLink key={item.href} {...item} variant="tab" />
            ))}
            <NavLink
              href={tabs.more.href}
              label={tabs.more.label}
              icon={tabs.more.icon}
              tour={tabs.more.tour}
              variant="tab"
              also={MORE_PATHS}
            />
          </div>
        </nav>
      </div>
    </div>
  );
}

/** The mark: a road with a moving signal dot. */
function Mark() {
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-road"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 17h18"
          stroke="var(--color-road-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
        <path
          d="M4 12h9l3-4h4"
          stroke="var(--color-road-text)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="8" r="2.2" fill="var(--color-road-signal)" />
      </svg>
    </span>
  );
}

/** Always visible on the practice desk, so sample data is never mistaken for real records. */
function PracticeBanner({ t }: { t: Strings }) {
  return (
    <div
      data-chrome
      className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-part-soft px-4 py-2 text-[14px] text-part ring-1 ring-part/20 lg:px-10"
    >
      <span className="font-semibold">{t.practice.banner}</span>
      <span className="ml-auto flex gap-2">
        <form action={resetPractice}>
          <button className="min-h-9 rounded-field px-3 font-semibold underline underline-offset-2">
            {t.practice.reset}
          </button>
        </form>
        <form action={leavePractice}>
          <button className="min-h-9 rounded-field bg-part px-3 font-semibold text-card">
            {t.practice.leave}
          </button>
        </form>
      </span>
    </div>
  );
}
