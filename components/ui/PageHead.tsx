import type { ReactNode } from "react";

import { BackLink } from "@/components/layout/BackLink";

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
      {back ? <BackLink href={back.href} label={back.label} /> : null}
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
  id,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** anchor for "↓" pointers (scroll-margin clears the sticky phone header) */
  id?: string;
}) {
  return (
    <section id={id} className={`grid scroll-mt-20 content-start gap-3 ${className}`}>
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
