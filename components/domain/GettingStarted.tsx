import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import type { Strings } from "@/content/strings";
import { startPractice } from "@/server/actions/practice";

/** First-run checklist on the real desk until the basics exist, with the tour as the last item. */
export function GettingStarted({
  t,
  done,
}: {
  t: Strings;
  done: { business: boolean; truck: boolean; driver: boolean; party: boolean };
}) {
  const items = [
    { key: "business", label: t.start.business, href: "/settings", ok: done.business },
    { key: "truck", label: t.start.truck, href: "/settings/trucks", ok: done.truck },
    { key: "driver", label: t.start.driver, href: "/settings/drivers", ok: done.driver },
    { key: "party", label: t.start.party, href: "/vendors/new", ok: done.party },
  ];
  return (
    <section
      aria-labelledby="start-title"
      className="grid gap-4 rounded-card bg-card p-5 shadow-card ring-2 ring-signal/40 sm:p-6"
    >
      <div>
        <h2 id="start-title" className="text-[20px] font-bold tracking-tight">
          {t.start.title}
        </h2>
        <p className="text-ink-2">{t.start.help}</p>
      </div>
      <ol className="grid gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="flex min-h-12 items-center gap-3 rounded-field px-2 hover:bg-paper"
            >
              <span
                aria-hidden
                className={`flex size-7 shrink-0 items-center justify-center rounded-full ${item.ok ? "bg-in text-card" : "ring-2 ring-rule-strong"}`}
              >
                {item.ok ? <Icon name="check" size={16} /> : null}
              </span>
              <span
                className={`flex-1 text-[16px] ${item.ok ? "text-ink-2 line-through" : "font-semibold"}`}
              >
                {item.label}
              </span>
              <Icon name="chevronRight" size={18} className="text-ink-3" />
            </Link>
          </li>
        ))}
      </ol>
      <form
        action={startPractice}
        className="grid gap-2 rounded-field bg-road p-4 text-road-text sm:grid-cols-[1fr_auto] sm:items-center"
      >
        <input type="hidden" name="tour" value="1" />
        <div>
          <p className="text-[16px] font-bold">{t.start.tour}</p>
          <p className="text-[14px] text-road-muted">{t.start.tourHelp}</p>
        </div>
        <button className="min-h-12 rounded-field bg-road-signal px-5 font-semibold text-road">
          {t.tour.start}
        </button>
      </form>
    </section>
  );
}
