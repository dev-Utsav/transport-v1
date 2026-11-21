import Link from "next/link";

import { RouteRail } from "@/components/domain/RouteRail";
import { Pill } from "@/components/ui/Pill";
import type { Strings } from "@/content/strings";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { TripListRow } from "@/server/queries/trips";

const TONE = { loading: "part", in_transit: "signal", arrived: "in", closed: "neutral" } as const;

/** One trip as a row: truck plate, status in words, the route rail, and what it carries. */
export function TripRow({ trip, t }: { trip: TripListRow; t: Strings }) {
  return (
    <li>
      <Link
        href={`/trips/${trip.id}`}
        className="grid gap-3 px-4 py-4 transition-colors duration-150 hover:bg-paper sm:grid-cols-[1fr_1.4fr_auto] sm:items-center sm:gap-6 sm:px-5"
      >
        <div className="flex items-center justify-between gap-3 sm:block">
          <div>
            <div className="font-mono text-[16px] font-medium tracking-wide">
              {trip.truckNumber}
            </div>
            <div className="text-[14px] text-ink-2">
              {formatDay(trip.departOn)}
              {trip.driverName ? ` · ${trip.driverName}` : ""}
            </div>
          </div>
          <span className="sm:mt-1.5 sm:inline-block">
            <Pill tone={TONE[trip.status]}>{t.tripStatus[trip.status]}</Pill>
          </span>
        </div>
        <RouteRail from={trip.fromPlace} to={trip.toPlace} status={trip.status} />
        <div className="flex justify-between gap-4 text-[14px] text-ink-2 sm:block sm:text-right">
          <div>
            <span className="num font-semibold text-ink">{trip.packages}</span> {t.trips.packages} ·{" "}
            {trip.challanCount} {t.nav.challans}
          </div>
          <div className="num text-[16px] font-semibold text-ink">{formatMoney(trip.freight)}</div>
        </div>
      </Link>
    </li>
  );
}
