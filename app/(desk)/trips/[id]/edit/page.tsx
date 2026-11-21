import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TripForm } from "@/components/forms/TripForm";
import { PageHead } from "@/components/ui/PageHead";
import { getT } from "@/server/lang";
import { placeOptions } from "@/server/queries/challans";
import { driverOptions, getTrip, truckOptions } from "@/server/queries/trips";

export const metadata: Metadata = { title: "Edit trip" };

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [t, trip, trucks, drivers, places] = await Promise.all([
    getT(),
    getTrip(id),
    truckOptions(true),
    driverOptions(true),
    placeOptions(),
  ]);
  if (!trip) notFound();
  return (
    <>
      <PageHead title={t.trips.edit} back={{ href: `/trips/${id}`, label: t.common.back }} />
      <TripForm
        t={{ common: t.common, trips: t.trips }}
        trucks={trucks.map(({ id: tid, number, type }) => ({ id: tid, number, type }))}
        drivers={drivers.map(({ id: did, name }) => ({ id: did, name }))}
        places={places}
        initial={{
          id: String(trip.id),
          truckId: String(trip.truckId),
          driverId: trip.driverId ? String(trip.driverId) : "",
          fromPlace: trip.fromPlace,
          toPlace: trip.toPlace,
          departOn: trip.departOn,
          expectedOn: trip.expectedOn ?? "",
          note: trip.note,
        }}
      />
    </>
  );
}
