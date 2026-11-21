import type { IconName } from "@/components/ui/Icon";
import type { Strings } from "@/content/strings";

export type NavItem = { href: string; label: string; icon: IconName; tour?: string };

export function mainNav(t: Strings): NavItem[] {
  return [
    { href: "/", label: t.nav.home, icon: "home" },
    { href: "/trips", label: t.nav.trips, icon: "truck" },
    { href: "/challans", label: t.nav.challans, icon: "receipt" },
    { href: "/vendors", label: t.nav.vendors, icon: "users", tour: "nav-vendors" },
    { href: "/expenses", label: t.nav.expenses, icon: "wallet", tour: "nav-office" },
    { href: "/salary", label: t.nav.salary, icon: "idCard" },
    { href: "/gst", label: t.nav.gst, icon: "percent" },
    { href: "/reports", label: t.nav.reports, icon: "chart" },
    { href: "/settings", label: t.nav.settings, icon: "settings" },
  ];
}

/** Phone tab bar: the four most used places, with New in the middle. */
export function tabNav(t: Strings): { left: NavItem[]; right: NavItem[]; more: NavItem } {
  return {
    left: [
      { href: "/", label: t.nav.home, icon: "home" },
      { href: "/trips", label: t.nav.trips, icon: "truck" },
    ],
    right: [{ href: "/vendors", label: t.nav.vendors, icon: "users", tour: "nav-vendors" }],
    more: { href: "/more", label: t.nav.more, icon: "more", tour: "nav-office" },
  };
}

/** Which nav item a path belongs to ("/" only matches itself). */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
