import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";

/** Ruled list inside a card: rows, not a grid of cards. */
export function RowList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <ul
      className={`divide-y divide-rule overflow-hidden rounded-card bg-card shadow-card ring-1 ring-rule ${className}`}
    >
      {children}
    </ul>
  );
}

/** One tappable row: main text on the left, figure on the right. Whole row is the link. */
export function RowLink({
  href,
  title,
  meta,
  aside,
  asideSub,
  muted,
  tour,
}: {
  href: string;
  title: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  asideSub?: ReactNode;
  muted?: boolean;
  /** hook for the guided tour */
  tour?: string | undefined;
}) {
  return (
    <li>
      <Link
        href={href}
        data-tour={tour}
        className={`flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-paper focus-visible:bg-paper sm:px-5 ${muted ? "opacity-60" : ""}`}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-semibold text-ink">{title}</div>
          {meta ? <div className="mt-0.5 truncate text-[14px] text-ink-2">{meta}</div> : null}
        </div>
        {aside !== undefined ? (
          <div className="shrink-0 text-right">
            <div className="num text-[16px] font-semibold text-ink">{aside}</div>
            {asideSub ? <div className="mt-0.5 text-[13px]">{asideSub}</div> : null}
          </div>
        ) : null}
        <Icon name="chevronRight" size={18} className="shrink-0 text-ink-3" />
      </Link>
    </li>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-rule-strong px-5 py-10 text-center text-[16px] text-ink-2">
      {children}
    </div>
  );
}

/** Label / value pairs (detail screens, review step). */
export function Facts({ items }: { items: readonly { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[13px] font-semibold tracking-wide text-ink-2 uppercase">
            {item.label}
          </dt>
          <dd className="mt-0.5 text-[16px] break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
