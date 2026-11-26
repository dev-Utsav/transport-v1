import type { IconName } from "@/components/ui/Icon";
import type { Strings } from "@/content/strings";
import type { Permission } from "@/lib/access";

/** Compact desktop menu: the checkbox id the shell's CSS reads, and the cookie that remembers it. */
export const SIDEBAR_INPUT_ID = "sidebar-collapsed";
export const SIDEBAR_COOKIE = "td_sidebar";

/** `need`: shown when the person holds any of these (empty = everyone signed in). */
export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  tour?: string;
  need: readonly Permission[];
};

export function mainNav(t: Strings): NavItem[] {
  return [
    { href: "/", label: t.nav.home, icon: "home", need: ["challans.view"] },
    { href: "/trips", label: t.nav.trips, icon: "truck", need: ["trips.view"] },
    { href: "/challans", label: t.nav.challans, icon: "receipt", need: ["challans.view"] },
    {
      href: "/vendors",
      label: t.nav.vendors,
      icon: "users",
      tour: "nav-vendors",
      need: ["parties.view"],
    },
    {
      href: "/expenses",
      label: t.nav.expenses,
      icon: "wallet",
      tour: "nav-office",
      need: ["expenses.view"],
    },
    { href: "/salary", label: t.nav.salary, icon: "idCard", need: ["salary.view"] },
    { href: "/gst", label: t.nav.gst, icon: "percent", need: ["gst.view"] },
    { href: "/reports", label: t.nav.reports, icon: "chart", need: ["reports.view"] },
    {
      href: "/settings",
      label: t.nav.settings,
      icon: "settings",
      need: ["settings.manage", "masters.manage", "users.manage", "backup.download"],
    },
  ];
}

/** Phone tab bar: the four most used places, with New in the middle. */
export function tabNav(t: Strings): { left: NavItem[]; right: NavItem[]; more: NavItem } {
  return {
    left: [
      { href: "/", label: t.nav.home, icon: "home", need: ["challans.view"] },
      { href: "/trips", label: t.nav.trips, icon: "truck", need: ["trips.view"] },
    ],
    right: [
      {
        href: "/vendors",
        label: t.nav.vendors,
        icon: "users",
        tour: "nav-vendors",
        need: ["parties.view"],
      },
    ],
    more: { href: "/more", label: t.nav.more, icon: "more", tour: "nav-office", need: [] },
  };
}

/** The items this person may open (the page checks again; this only hides closed doors). */
export function allowedNav(items: NavItem[], held: ReadonlySet<Permission>): NavItem[] {
  return items.filter((i) => i.need.length === 0 || i.need.some((p) => held.has(p)));
}

/** Which nav item a path belongs to ("/" only matches itself). */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
