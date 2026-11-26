import { IntentLink } from "@/components/ui/IntentLink";

import type { Strings } from "@/content/strings";
import { fill } from "@/content/strings";
import { FLOW } from "@/lib/flow";
import type { FlowStage } from "@/lib/flow";
import { formatMoney } from "@/lib/money";
import type { flowCounts } from "@/server/queries/flow";

type Counts = Awaited<ReturnType<typeof flowCounts>>;

/**
 * Home's work board: the five steps in order, each with what is waiting and its one button.
 * A step with work waiting is marked so the eye goes there first.
 */
export function FlowBoard({ t, counts }: { t: Strings; counts: Counts }) {
  const loadHref = counts.firstLoadingTripId ? `/trips/${counts.firstLoadingTripId}` : "/trips/new";
  const steps: Record<FlowStage, { count: string; href: string; cta: string; hasWork: boolean }> = {
    book: {
      count: fill(t.flow.count.book, { n: counts.bookedToday }),
      href: "/challans/new",
      cta: t.flow.cta.book,
      hasWork: false,
    },
    load: {
      count: fill(t.flow.count.load, { n: counts.waiting }),
      href: loadHref,
      cta: counts.firstLoadingTripId ? t.flow.cta.load : t.flow.cta.loadNoTrip,
      hasWork: counts.waiting > 0,
    },
    road: {
      count: fill(t.flow.count.road, { n: counts.loading + counts.onRoad }),
      href: "/trips",
      cta: t.flow.cta.road,
      hasWork: counts.loading > 0,
    },
    deliver: {
      count: fill(t.flow.count.deliver, { n: counts.arrived }),
      href: "/trips#arrived",
      cta: t.flow.cta.deliver,
      hasWork: counts.arrived > 0,
    },
    collect: {
      count: fill(t.flow.count.collect, {
        amount: formatMoney(counts.pending),
        n: counts.pendingParties,
      }),
      href: "/vendors?due=1",
      cta: t.flow.cta.collect,
      hasWork: counts.pending > 0,
    },
  };
  return (
    <section aria-labelledby="flow-title" className="grid gap-3" data-tour="flow-board">
      <div>
        <h2 id="flow-title" className="text-[18px] font-bold tracking-tight">
          {t.flow.title}
        </h2>
        <p className="text-[15px] text-ink-2">{t.flow.help}</p>
      </div>
      <ol className="relative grid gap-2 lg:grid-cols-5 lg:gap-3">
        {FLOW.map((stage, i) => {
          const s = steps[stage];
          const isFirst = i === 0;
          return (
            <li
              key={stage}
              className={`relative grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 rounded-card bg-card p-4 shadow-card ring-1 lg:grid-cols-1 lg:content-between lg:gap-3 ${s.hasWork ? "ring-signal/50" : "ring-rule"}`}
            >
              <span
                aria-hidden
                className={`num row-span-2 flex size-9 items-center justify-center rounded-full text-[16px] font-bold lg:row-span-1 ${isFirst || s.hasWork ? "bg-signal text-card" : "bg-paper-deep text-ink"}`}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[16px] leading-snug font-bold">
                  {t.flow.long[stage]}
                </span>
                <span
                  className={`block text-[14px] ${s.hasWork ? "font-semibold text-signal-ink" : "text-ink-2"}`}
                >
                  {s.count}
                </span>
              </span>
              <IntentLink
                href={s.href}
                data-tour={`flow-${stage}-cta`}
                className={`row-span-2 inline-flex min-h-11 items-center justify-center rounded-field px-3 text-center text-[14px] font-semibold transition-colors duration-150 lg:row-span-1 lg:min-h-12 ${isFirst ? "bg-signal text-card hover:bg-signal-hover" : "bg-paper text-ink ring-1 ring-rule-strong hover:bg-paper-deep"}`}
              >
                {s.cta}
              </IntentLink>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
