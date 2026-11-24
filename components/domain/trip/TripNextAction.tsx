import { RouteRail } from "@/components/domain/RouteRail";
import { StatusStepper } from "@/components/domain/StatusStepper";
import type { Strings } from "@/content/strings";
import { fill } from "@/content/strings";
import { formatDay } from "@/lib/dates";
import { tripNextAction } from "@/lib/flow";
import { TRIP_STATUSES } from "@/lib/types";
import type { TripStatus } from "@/lib/types";
import { advanceTrip } from "@/server/actions/flow";
import { setTripStatus } from "@/server/actions/trips";

import type { TripCan } from "@/components/domain/trip/trip-can";

/**
 * The truck's road and its one next action as a big button. Mistakes can be corrected with
 * the full status row, tucked under "Correct the status".
 */
export function TripNextAction({
  t,
  trip,
  undelivered,
  can,
}: {
  t: Strings;
  can: Pick<TripCan, "advance" | "manage">;
  trip: {
    id: number;
    fromPlace: string;
    toPlace: string;
    status: TripStatus;
    expectedOn: string | null;
  };
  undelivered: number;
}) {
  const action = tripNextAction(trip.status, undelivered);
  const label = {
    dispatch: { title: t.tripFlow.dispatch, help: t.tripFlow.dispatchHelp },
    arrive: { title: t.tripFlow.arrive, help: fill(t.tripFlow.arriveHelp, { to: trip.toPlace }) },
    deliver: { title: t.tripFlow.deliver, help: t.tripFlow.deliverHelp },
    close: { title: t.tripFlow.close, help: t.tripFlow.closeHelp },
  };
  return (
    <section
      className="grid gap-5 rounded-card bg-road p-5 text-road-text shadow-lift sm:p-6"
      aria-label={t.trips.route}
      data-tour="trip-road"
    >
      <RouteRail from={trip.fromPlace} to={trip.toPlace} status={trip.status} tone="dark" />
      {trip.expectedOn && trip.status !== "closed" ? (
        <p className="text-[14px] text-road-muted">
          {t.trips.expectedOn}:{" "}
          <span className="font-semibold text-road-text">{formatDay(trip.expectedOn)}</span>
        </p>
      ) : null}

      {action === null ? (
        <p className="text-[16px] font-semibold">{t.tripFlow.closed}</p>
      ) : action === "deliver" ? (
        <div className="grid gap-1 rounded-field bg-road-2 p-4">
          <p className="text-[17px] font-bold">{label.deliver.title} ↓</p>
          <p className="text-[14px] text-road-muted">{label.deliver.help}</p>
        </div>
      ) : !can.advance ? (
        <p className="text-[16px] font-semibold">{label[action].title}</p>
      ) : (
        <form action={advanceTrip} className="grid gap-2" data-no-print>
          <input type="hidden" name="id" value={trip.id} />
          <button
            name="action"
            value={action}
            data-tour="next-action"
            data-state={action}
            className="min-h-14 rounded-field bg-road-signal px-5 text-[17px] font-bold text-road transition-transform duration-150 active:scale-[0.99]"
          >
            {label[action].title}
          </button>
          <p className="text-[14px] text-road-muted">{label[action].help}</p>
        </form>
      )}

      {can.manage ? (
        <details className="text-[14px]" data-no-print>
          <summary className="cursor-pointer text-road-muted">{t.tripFlow.correct}</summary>
          <div className="mt-3">
            <StatusStepper
              id={trip.id}
              statuses={TRIP_STATUSES}
              current={trip.status}
              labels={t.tripStatus}
              legend={t.trips.moveTo}
              action={setTripStatus}
              dark
            />
          </div>
        </details>
      ) : null}
    </section>
  );
}
