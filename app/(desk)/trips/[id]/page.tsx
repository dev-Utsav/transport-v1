import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Saved } from "@/components/domain/Saved";
import { FlowBar } from "@/components/domain/FlowBar";
import { Money } from "@/components/domain/Money";
import { LoadPanel } from "@/components/domain/trip/LoadPanel";
import { TripLoadList } from "@/components/domain/trip/TripLoadList";
import { TripNextAction } from "@/components/domain/trip/TripNextAction";
import type { TripCan } from "@/components/domain/trip/trip-can";
import { ButtonLink } from "@/components/ui/Button";
import { PageHead, Section } from "@/components/ui/PageHead";
import { Empty, RowList } from "@/components/ui/Rows";
import { Stats } from "@/components/ui/Stats";
import { categoryLabel } from "@/content/strings";
import { formatDay } from "@/lib/dates";
import { tripStage } from "@/lib/flow";
import { formatMoney } from "@/lib/money";
import { can, requireAccess, tripScope } from "@/server/auth";
import { getT } from "@/server/lang";
import { waitingChallans } from "@/server/queries/flow";
import { getTripDetail } from "@/server/queries/trips";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Trip" };

/**
 * One truck's trip, laid out in flow order: the road and its next action, then (while loading)
 * the parcels waiting for a truck, then what is on the truck, then the trip's money.
 */
export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const id = Number((await params).id);
  const { saved } = await searchParams;
  const actor = await requireAccess("trips.view");
  const [t, settings, detail] = await Promise.all([
    getT(),
    getSettings(),
    getTripDetail(id, tripScope(actor)),
  ]);
  if (!detail) notFound();
  const { trip, groups, totals, expenses } = detail;
  const allowed: TripCan = {
    manage: can(actor, "trips.manage"),
    load: can(actor, "trips.load"),
    advance: can(actor, "trips.advance"),
    deliver: can(actor, "trips.deliver"),
    openChallans: can(actor, "challans.view"),
    openParties: can(actor, "parties.view"),
    takePayment: can(actor, "payments.record"),
  };
  const showMoney = can(actor, "expenses.view");
  const waiting = trip.status === "loading" && allowed.load ? await waitingChallans() : [];

  return (
    <>
      <FlowBar t={t} current={tripStage(trip.status)} />
      <Saved show={saved === "1"} label={t.common.saved} />
      <PageHead
        back={{ href: "/trips", label: t.trips.title }}
        title={<span className="font-mono tracking-wide">{trip.truckNumber}</span>}
        sub={[trip.truckType, trip.driverName, `${t.trips.departOn}: ${formatDay(trip.departOn)}`]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <ButtonLink href={`/trips/${trip.id}/print`} variant="secondary" icon="print">
              {t.tripFlow.manifest}
            </ButtonLink>
            {allowed.manage ? (
              <ButtonLink href={`/trips/${trip.id}/edit`} variant="secondary">
                {t.common.edit}
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <div className="grid gap-8">
        <TripNextAction
          t={t}
          trip={trip}
          undelivered={totals.undelivered}
          loaded={groups.length}
          due={totals.due}
          can={allowed}
        />

        {trip.status === "loading" && allowed.load ? (
          <LoadPanel
            t={t}
            tripId={trip.id}
            toPlace={trip.toPlace}
            prefix={settings.challanPrefix}
            waiting={waiting}
          />
        ) : null}

        <Section title={t.trips.onTruck} id="on-truck">
          <Stats
            items={[
              { label: t.trips.parties, value: groups.length },
              { label: t.trips.packages, value: totals.packages },
              { label: t.trips.freight, value: formatMoney(totals.freight) },
              {
                label: t.trips.toCollect,
                value: formatMoney(totals.due),
                tone: totals.due > 0 ? "due" : "in",
              },
            ]}
          />
          {groups.length ? (
            <TripLoadList t={t} detail={detail} prefix={settings.challanPrefix} can={allowed} />
          ) : (
            <Empty>{t.trips.noChallans}</Empty>
          )}
        </Section>

        {showMoney ? (
          <Section
            title={t.trips.expenses}
            action={
              <Link
                href={`/expenses/new?trip=${trip.id}`}
                className="text-[15px] font-semibold text-signal-ink hover:underline"
              >
                + {t.expenses.new}
              </Link>
            }
          >
            <RowList>
              {expenses.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <span>
                    {categoryLabel(t, e.category)}{" "}
                    <span className="text-[14px] text-ink-2">· {formatDay(e.day)}</span>
                  </span>
                  <Money paise={e.amount} className="font-semibold" />
                </li>
              ))}
              <li className="grid gap-1 bg-paper/60 px-4 py-3.5 sm:px-5">
                <div className="flex justify-between gap-3 text-[15px] text-ink-2">
                  <span>
                    {t.trips.freight} − {t.trips.expenses}
                  </span>
                  <span className="num">
                    {formatMoney(totals.freight)} − {formatMoney(totals.spent)}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-[18px] font-bold">
                  <span>{t.trips.profit}</span>
                  <Money paise={totals.profit} tone={totals.profit < 0 ? "due" : "in"} />
                </div>
              </li>
            </RowList>
          </Section>
        ) : null}
      </div>
    </>
  );
}
