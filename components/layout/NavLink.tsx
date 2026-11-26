"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActive } from "@/components/layout/nav";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";

/** The only client part of the shell: it needs the current path to mark itself active. */
export function NavLink({
  href,
  label,
  icon,
  variant,
  also,
  tour,
}: {
  href: string;
  label: string;
  icon: IconName;
  variant: "side" | "tab";
  /** extra path prefixes that count as this item (More covers Expenses, Salary…) */
  also?: readonly string[];
  /** hook for the guided tour */
  tour?: string | undefined;
}) {
  const pathname = usePathname();
  const active = isActive(href, pathname) || (also ?? []).some((p) => isActive(p, pathname));

  if (variant === "tab") {
    return (
      <Link
        href={href}
        data-tour={tour}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[12px] font-semibold transition-colors duration-150 ${active ? "text-signal" : "text-ink-2"}`}
      >
        <Icon name={icon} size={24} />
        {label}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      data-tour={tour}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`flex min-h-11 items-center gap-3 rounded-field px-3 text-[15px] font-semibold whitespace-nowrap transition-colors duration-150 ${active ? "bg-card text-ink shadow-card ring-1 ring-rule" : "text-ink-2 hover:bg-paper-deep hover:text-ink"}`}
    >
      <Icon name={icon} size={20} className={`shrink-0 ${active ? "text-signal" : ""}`} />
      {label}
    </Link>
  );
}
