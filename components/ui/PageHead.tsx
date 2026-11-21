import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";

/** Page title block: optional back link, the one h1, a short line under it, actions on the right. */
export function PageHead({
  title,
  sub,
  back,
  actions,
}: {
  title: ReactNode;
  sub?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 grid gap-3 sm:mb-8">
      {back ? (
        <Link
          href={back.href}
          className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-1 text-[15px] font-semibold text-ink-2 hover:text-ink"
          data-no-print
        >
          <Icon name="chevronLeft" size={18} />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight text-ink sm:text-[34px]">
            {title}
          </h1>
          {sub ? <div className="text-[16px] text-ink-2">{sub}</div> : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap gap-2" data-no-print>
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`grid content-start gap-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-bold tracking-tight text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card bg-card shadow-card ring-1 ring-rule ${className}`}>
      {children}
    </div>
  );
}
