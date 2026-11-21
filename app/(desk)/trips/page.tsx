import type { Metadata } from "next";

import { TripRow } from "@/components/domain/TripRow";
import { ButtonLink } from "@/components/ui/Button";
import { PageHead, Section } from "@/components/ui/PageHead";
import { Empty, RowList } from "@/components/ui/Rows";
import { getT } from "@/server/lang";
import { listTrips } from "@/server/queries/trips";

export const metadata: Metadata = { title: "Trips" };

/** Trucks in flow order: loading (step 2), on the road (3), arrived to deliver (4), then closed. */
export default async function TripsPage() {
  const [t, open, closed] = await Promise.all([getT(), listTrips("open"), listTrips("closed")]);
  const groups = [
    {
      id: "loading",
      n: 2,
      title: t.flow.long.load,
      rows: open.filter((r) => r.status === "loading"),
    },
    {
      id: "road",
      n: 3,
      title: t.flow.long.road,
      rows: open.filter((r) => r.status === "in_transit"),
    },
    {
      id: "arrived",
      n: 4,
      title: t.flow.long.deliver,
      rows: open.filter((r) => r.status === "arrived"),
    },
  ];
  return (
    <>
      <PageHead
        title={t.trips.title}
        sub={t.flow.help1.load}
        actions={
          <ButtonLink href="/trips/new" icon="plus">
            {t.trips.new}
          </ButtonLink>
        }
      />
      <div className="grid gap-8">
        {groups.map((g) => (
          <Section key={g.id} title={`${g.n} · ${g.title} · ${g.rows.length}`}>
            <div id={g.id} className="-mt-16 pt-16" />
            {g.rows.length ? (
              <RowList>
                {g.rows.map((trip) => (
                  <TripRow key={trip.id} trip={trip} t={t} />
                ))}
              </RowList>
            ) : (
              <Empty>{t.common.nothing}</Empty>
            )}
          </Section>
        ))}
        {closed.length ? (
          <Section title={t.trips.closedList}>
            <RowList>
              {closed.map((trip) => (
                <TripRow key={trip.id} trip={trip} t={t} />
              ))}
            </RowList>
          </Section>
        ) : null}
      </div>
    </>
  );
}
