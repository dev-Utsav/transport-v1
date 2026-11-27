import { IntentLink } from "@/components/ui/IntentLink";

import { Money } from "@/components/domain/Money";
import type { Strings } from "@/content/strings";
import { formatChallanNo } from "@/lib/challan-no";
import { formatDay } from "@/lib/dates";
import { sortForTruck } from "@/lib/flow";
import { loadOnTrip } from "@/server/actions/flow";
import type { WaitingChallan } from "@/server/queries/flow";

/**
 * Loading checklist: every parcel waiting for a truck, the ones going where this truck goes
 * first. Tick and load in one go. Plain checkboxes in a form, so it works without JS.
 */
export function LoadPanel({
  t,
  tripId,
  toPlace,
  prefix,
  waiting,
}: {
  t: Strings;
  tripId: number;
  toPlace: string;
  prefix: string;
  waiting: WaitingChallan[];
}) {
  const sorted = sortForTruck(waiting, toPlace);
  const target = toPlace.trim().toLowerCase();
  const firstOther = sorted.findIndex((w) => w.toPlace.trim().toLowerCase() !== target);
  return (
    <section
      id="load"
      className="grid scroll-mt-20 gap-3"
      aria-labelledby="load-title"
      data-no-print
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="load-title" className="text-[18px] font-bold tracking-tight">
            {t.tripFlow.waiting} · {waiting.length}
          </h2>
          <p className="text-[15px] text-ink-2">{t.tripFlow.waitingHelp}</p>
        </div>
        <IntentLink
          href={`/challans/new?trip=${tripId}`}
          className="-my-3 py-3 text-[15px] font-semibold text-signal-ink hover:underline"
        >
          + {t.tripFlow.bookForTruck}
        </IntentLink>
      </div>
      {sorted.length ? (
        <form action={loadOnTrip} className="grid gap-3">
          <input type="hidden" name="tripId" value={tripId} />
          <ul
            data-tour="load-panel"
            className="divide-y divide-rule overflow-hidden rounded-card bg-card shadow-card ring-1 ring-rule"
          >
            {sorted.map((w, i) => (
              <li key={w.id}>
                {i === firstOther && firstOther > 0 ? (
                  <p className="bg-paper/60 px-4 py-2 text-[13px] font-semibold text-ink-2 uppercase">
                    {t.tripFlow.otherPlace}
                  </p>
                ) : null}
                <label className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 hover:bg-paper has-checked:bg-signal-soft sm:px-5">
                  <input type="checkbox" name="ids" value={w.id} className="size-6 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">
                      <span className="mr-2 font-mono font-medium">
                        {formatChallanNo(w.no, prefix)}
                      </span>
                      {w.senderName} → {w.receiverName}
                    </span>
                    <span className="block truncate text-[13px] text-ink-2">
                      {w.toPlace} · {w.packages} {t.trips.packages}
                      {w.description ? ` · ${w.description}` : ""} · {t.payTypes[w.payType]} ·{" "}
                      {formatDay(w.bookedOn)}
                    </span>
                  </span>
                  <Money paise={w.total} className="shrink-0 text-[15px] font-semibold" />
                </label>
              </li>
            ))}
          </ul>
          <button
            data-tour="load-submit"
            className="min-h-13 rounded-field bg-signal px-5 text-[16px] font-bold text-card hover:bg-signal-hover sm:justify-self-start"
          >
            {t.tripFlow.loadSelected}
          </button>
        </form>
      ) : (
        <p className="rounded-card border border-dashed border-rule-strong px-5 py-6 text-center text-ink-2">
          {t.tripFlow.noneWaiting}
        </p>
      )}
    </section>
  );
}
