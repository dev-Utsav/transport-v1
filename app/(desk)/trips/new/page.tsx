import type { Metadata } from "next";

import { FlowBar } from "@/components/domain/FlowBar";
import { TripForm } from "@/components/forms/TripForm";
import { ButtonLink } from "@/components/ui/Button";
import { PageHead } from "@/components/ui/PageHead";
import { Empty } from "@/components/ui/Rows";
import { istDay } from "@/lib/dates";
import { getT } from "@/server/lang";
import { getChallan, placeOptions } from "@/server/queries/challans";
import { driverOptions, truckOptions } from "@/server/queries/trips";

export const metadata: Metadata = { title: "New trip" };

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ challan?: string }>;
}) {
  const { challan } = await searchParams;
  const challanId = Number(challan) || 0;
  const [t, trucks, drivers, places, parcel] = await Promise.all([
    getT(),
    truckOptions(),
    driverOptions(),
    placeOptions(),
    challanId ? getChallan(challanId) : Promise.resolve(null),
  ]);
  return (
    <>
      <FlowBar t={t} current="load" />
      <PageHead
        title={t.trips.new}
        sub={t.flow.help1.load}
        back={{ href: "/trips", label: t.trips.title }}
      />
      {trucks.length ? (
        <TripForm
          t={{ common: t.common, trips: t.trips }}
          trucks={trucks.map(({ id, number, type }) => ({ id, number, type }))}
          drivers={drivers.map(({ id, name }) => ({ id, name }))}
          places={places}
          initial={{
            fromPlace: "Kadodara",
            departOn: istDay(),
            toPlace: parcel?.challan.toPlace ?? "",
            challanId: parcel && !parcel.challan.tripId ? String(parcel.challan.id) : "",
          }}
        />
      ) : (
        <div className="grid max-w-xl gap-4">
          <Empty>{t.trips.noTrucksYet}</Empty>
          <ButtonLink href="/settings/trucks" variant="secondary">
            {t.settings.newTruck}
          </ButtonLink>
        </div>
      )}
    </>
  );
}
