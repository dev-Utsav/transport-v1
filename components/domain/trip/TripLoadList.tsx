import Link from "next/link";

import { Money } from "@/components/domain/Money";
import { RemindButton } from "@/components/domain/RemindButton";
import { COLLECT_TONE, Pill } from "@/components/ui/Pill";
import type { Strings } from "@/content/strings";
import { fill } from "@/content/strings";
import { formatChallanNo } from "@/lib/challan-no";
import { formatMoney } from "@/lib/money";
import { PAY_MODES } from "@/lib/types";
import type { TripStatus } from "@/lib/types";
import { deliverChallan, unloadFromTrip } from "@/server/actions/flow";
import type { getTripDetail } from "@/server/queries/trips";

import type { TripCan } from "@/components/domain/trip/trip-can";

type Detail = NonNullable<Awaited<ReturnType<typeof getTripDetail>>>;
type Row = Detail["groups"][number]["challans"][number];

/**
 * What is on the truck, grouped by the party who pays. The row actions follow the trip:
 * while loading a parcel can be taken off; once arrived each parcel is delivered here,
 * with To-Pay money taken in the same tap.
 */
export function TripLoadList({
  t,
  detail,
  prefix,
  can,
}: {
  t: Strings;
  detail: Detail;
  prefix: string;
  can: TripCan;
}) {
  // Without access to parties / challans the rows are plain text, not links to a closed door.
  const PartyLink = can.openParties ? Link : "div";
  const ChallanLink = can.openChallans ? Link : "div";
  const status = detail.trip.status;
  // The tour points at the first parcel still to deliver.
  const firstToDeliver = detail.groups
    .flatMap((g) => g.challans)
    .find((c) => c.status !== "delivered")?.id;
  return (
    <div className="grid gap-4">
      {detail.groups.map((g) => (
        <article
          key={g.partyId}
          className="overflow-hidden rounded-card bg-card shadow-card ring-1 ring-rule"
        >
          <header className="flex flex-wrap items-center gap-3 border-b border-rule bg-paper/60 px-4 py-3 sm:px-5">
            <PartyLink href={`/vendors/${g.partyId}`} className="min-w-0 flex-1">
              <h3 className="truncate text-[17px] font-bold">{g.name}</h3>
              <p className="text-[14px] text-ink-2">
                <span className="num">{g.packages}</span> {t.trips.packages} ·{" "}
                <Money paise={g.freight} />
                {g.due > 0 ? (
                  <span className="font-semibold text-due">
                    {" "}
                    · {t.challans.due} <Money paise={g.due} />
                  </span>
                ) : null}
              </p>
            </PartyLink>
            {g.due > 0 && g.phone && status !== "loading" ? (
              <RemindButton t={t} name={g.name} phone={g.phone} balance={g.due} compact />
            ) : null}
          </header>
          <ul className="divide-y divide-rule">
            {g.challans.map((c) => (
              <li key={c.id} className="grid grid-cols-[minmax(0,1fr)] gap-3 px-4 py-3 sm:px-5">
                <ChallanLink href={`/challans/${c.id}`} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 font-mono text-[14px] font-medium">
                    {formatChallanNo(c.no, prefix)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">
                      {c.senderName} → {c.receiverName}
                    </span>
                    <span className="block truncate text-[13px] text-ink-2">
                      {c.packages} {t.trips.packages}
                      {c.description ? ` · ${c.description}` : ""} · {t.payTypes[c.payType]}
                    </span>
                  </span>
                  <span className="grid shrink-0 justify-items-end gap-1">
                    <Money paise={c.total} className="text-[15px] font-semibold" />
                    {c.status === "delivered" ? (
                      <Pill tone="in">{t.challanStatus.delivered}</Pill>
                    ) : (
                      <Pill tone={COLLECT_TONE[c.state]}>{t.collect[c.state]}</Pill>
                    )}
                  </span>
                </ChallanLink>
                <RowActions
                  t={t}
                  status={status}
                  row={c}
                  tripId={detail.trip.id}
                  isFirst={c.id === firstToDeliver}
                  can={can}
                />
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function RowActions({
  t,
  status,
  row,
  tripId,
  isFirst,
  can,
}: {
  t: Strings;
  status: TripStatus;
  row: Row;
  tripId: number;
  isFirst: boolean;
  can: TripCan;
}) {
  if (status === "loading") {
    if (!can.load) return null;
    return (
      <form action={unloadFromTrip} className="justify-self-end" data-no-print>
        <input type="hidden" name="id" value={row.id} />
        <button className="min-h-10 rounded-field px-3 text-[14px] font-semibold text-ink-2 ring-1 ring-rule-strong hover:bg-paper">
          {t.tripFlow.remove}
        </button>
      </form>
    );
  }
  if (status !== "arrived" || row.status === "delivered" || !can.deliver) return null;
  const back = `/trips/${tripId}`;
  if (row.due > 0 && row.payType === "to_pay") {
    return (
      <div className="grid gap-2 rounded-field bg-paper p-3" data-no-print>
        <form
          action={deliverChallan}
          className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center"
        >
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="back" value={back} />
          <fieldset className="flex min-w-0 gap-1 rounded-field bg-card p-1 ring-1 ring-rule-strong">
            <legend className="sr-only">{t.challans.payNowMode}</legend>
            {PAY_MODES.map((m) => (
              <label
                key={m}
                className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-[9px] px-1.5 text-center text-[13px] leading-tight font-semibold text-ink-2 has-checked:bg-road has-checked:text-road-text has-focus-visible:outline-3 has-focus-visible:outline-signal"
              >
                <input
                  type="radio"
                  name="mode"
                  value={m}
                  defaultChecked={m === "cash"}
                  className="sr-only"
                />
                {t.modes[m]}
              </label>
            ))}
          </fieldset>
          <button
            data-tour={isFirst ? "deliver-first" : undefined}
            className="min-h-12 rounded-field bg-signal px-4 text-[15px] font-bold text-card hover:bg-signal-hover"
          >
            {fill(t.tripFlow.deliveredPaid, { amount: formatMoney(row.due) })}
          </button>
        </form>
        <form action={deliverChallan} className="justify-self-end">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="back" value={back} />
          <button className="min-h-10 px-2 text-[14px] font-semibold text-ink-2 underline underline-offset-2">
            {t.tripFlow.deliveredLater}
          </button>
        </form>
      </div>
    );
  }
  return (
    <form action={deliverChallan} className="justify-self-end" data-no-print>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="back" value={back} />
      <button
        data-tour={isFirst ? "deliver-first" : undefined}
        className="min-h-12 rounded-field bg-signal px-5 text-[15px] font-bold text-card hover:bg-signal-hover"
      >
        {t.tripFlow.delivered}
      </button>
    </form>
  );
}
