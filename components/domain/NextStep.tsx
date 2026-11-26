import { IntentLink } from "@/components/ui/IntentLink";

import { buttonClass } from "@/components/ui/Button";
import type { Strings } from "@/content/strings";
import { fill } from "@/content/strings";
import type { ChallanNext } from "@/lib/flow";
import { formatMoney } from "@/lib/money";
import { PAY_MODES } from "@/lib/types";
import { deliverChallan, loadOnTrip } from "@/server/actions/flow";

/**
 * The one thing to do next with this challan, in words and as the button that does it.
 * Shown at the top of every challan, so the admin never has to work out what comes next.
 */
export function NextStep({
  t,
  next,
  challanId,
  partyId,
  truckNumber,
  loading,
}: {
  t: Strings;
  next: ChallanNext;
  challanId: number;
  partyId: number;
  truckNumber: string | null;
  loading: { id: number; toPlace: string; truckNumber: string }[];
}) {
  const box = "grid gap-3 rounded-card p-5 shadow-card ring-1 sm:p-6";
  const tone =
    next.kind === "done"
      ? "bg-in-soft ring-in/30"
      : next.kind === "cancelled"
        ? "bg-paper-deep ring-rule"
        : "bg-card ring-signal/40";
  return (
    <section
      className={`${box} ${tone}`}
      aria-labelledby="next-title"
      data-tour="next-step"
      data-no-print
    >
      <h2 id="next-title" className="text-[13px] font-semibold tracking-wide text-ink-2 uppercase">
        {t.next.title}
      </h2>
      <Body
        t={t}
        next={next}
        challanId={challanId}
        partyId={partyId}
        truckNumber={truckNumber}
        loading={loading}
      />
    </section>
  );
}

function Body({
  t,
  next,
  challanId,
  partyId,
  truckNumber,
  loading,
}: Parameters<typeof NextStep>[0]) {
  const text = "text-[17px] font-semibold";
  switch (next.kind) {
    case "load":
      return (
        <>
          <p className={text}>{t.next.load}</p>
          {loading.length ? (
            <form action={loadOnTrip} className="grid gap-2 sm:flex sm:flex-wrap">
              <input type="hidden" name="ids" value={challanId} />
              {loading.map((trip, i) => (
                <button
                  key={trip.id}
                  name="tripId"
                  value={trip.id}
                  data-tour={i === 0 ? "load-on-trip" : undefined}
                  className={buttonClass(i === 0 ? "primary" : "secondary")}
                >
                  {fill(t.next.loadOn, { truck: trip.truckNumber, to: trip.toPlace })}
                </button>
              ))}
            </form>
          ) : (
            <p className="text-ink-2">{t.next.noTrips}</p>
          )}
          <IntentLink
            href={`/trips/new?challan=${challanId}`}
            className="-my-3 py-3 text-[15px] font-semibold text-signal-ink underline-offset-2 hover:underline"
          >
            + {t.next.startTrip}
          </IntentLink>
        </>
      );
    case "wait-dispatch":
    case "on-road":
      return (
        <>
          <p className={text}>
            {fill(next.kind === "on-road" ? t.next.onRoad : t.next.waitDispatch, {
              truck: truckNumber ?? "",
            })}
          </p>
          <IntentLink
            href={`/trips/${next.tripId}`}
            className={`${buttonClass("primary")} sm:justify-self-start`}
          >
            {t.next.openTrip}
          </IntentLink>
        </>
      );
    case "deliver":
      return (
        <>
          <p className={text}>{t.next.deliver}</p>
          <form action={deliverChallan} className="flex flex-wrap gap-2">
            <input type="hidden" name="id" value={challanId} />
            <button className={buttonClass("primary")}>{t.tripFlow.delivered}</button>
            {next.tripId ? (
              <IntentLink href={`/trips/${next.tripId}`} className={buttonClass("secondary")}>
                {t.next.openTrip}
              </IntentLink>
            ) : null}
          </form>
        </>
      );
    case "collect":
      return (
        <>
          <p className={text}>{fill(t.next.collect, { amount: formatMoney(next.due) })}</p>
          <div className="flex flex-wrap gap-2">
            {PAY_MODES.map((m) => (
              <IntentLink
                key={m}
                href={`/payments/new?vendor=${partyId}&challan=${challanId}&mode=${m}`}
                className={buttonClass(m === "cash" ? "primary" : "secondary")}
              >
                {t.modes[m]}
              </IntentLink>
            ))}
          </div>
        </>
      );
    case "done":
      return <p className={`${text} text-in`}>✓ {t.next.done}</p>;
    case "cancelled":
      return <p className={text}>{t.next.cancelled}</p>;
  }
}
