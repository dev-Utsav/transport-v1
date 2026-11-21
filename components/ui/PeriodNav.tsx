import Link from "next/link";

import { Icon } from "@/components/ui/Icon";

/** ‹ November 2026 › — plain links, so it works without JS and the URL is shareable. */
export function PeriodNav({
  label,
  prevHref,
  nextHref,
  prevLabel,
  nextLabel,
}: {
  label: string;
  prevHref: string;
  nextHref: string | null;
  prevLabel: string;
  nextLabel: string;
}) {
  const btn =
    "inline-flex size-12 items-center justify-center rounded-field bg-card ring-1 ring-rule-strong hover:bg-paper";
  return (
    <nav className="flex items-center gap-2" aria-label={label} data-no-print>
      <Link href={prevHref} className={btn} aria-label={prevLabel}>
        <Icon name="chevronLeft" />
      </Link>
      <span className="min-w-36 text-center text-[17px] font-semibold">{label}</span>
      {nextHref ? (
        <Link href={nextHref} className={btn} aria-label={nextLabel}>
          <Icon name="chevronRight" />
        </Link>
      ) : (
        <span className={`${btn} opacity-40`} aria-hidden>
          <Icon name="chevronRight" />
        </span>
      )}
    </nav>
  );
}
