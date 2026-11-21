import type { Metadata } from "next";

import { FlowBar } from "@/components/domain/FlowBar";
import { ChallanForm } from "@/components/forms/ChallanForm";
import { PageHead } from "@/components/ui/PageHead";
import { formatDay, istDay } from "@/lib/dates";
import { formatRate } from "@/lib/gst";
import { getT } from "@/server/lang";
import { placeOptions } from "@/server/queries/challans";
import { tripOptions } from "@/server/queries/trips";
import { vendorOptions } from "@/server/queries/vendors";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "New challan" };

export default async function NewChallanPage({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string }>;
}) {
  const { trip } = await searchParams;
  const [t, settings, parties, trips, places] = await Promise.all([
    getT(),
    getSettings(),
    vendorOptions(),
    tripOptions(),
    placeOptions(),
  ]);
  const preset = trips.find((tr) => String(tr.id) === trip);
  return (
    <>
      <FlowBar t={t} current="book" />
      <PageHead
        title={t.challans.new}
        sub={t.flow.help1.book}
        back={
          preset
            ? { href: `/trips/${preset.id}`, label: preset.truckNumber }
            : { href: "/challans", label: t.challans.title }
        }
      />
      <ChallanForm
        t={{
          common: t.common,
          challans: t.challans,
          payTypes: t.payTypes,
          payTypeHelp: t.payTypeHelp,
          modes: t.modes,
          gstModes: t.gstModes,
          trips: t.trips,
        }}
        parties={parties.map(({ id, name }) => ({ id, name }))}
        trips={trips.map((tr) => ({
          id: tr.id,
          toPlace: tr.toPlace,
          label: `${tr.truckNumber} · ${tr.toPlace} · ${formatDay(tr.departOn)}`,
        }))}
        places={places}
        initial={{
          bookedOn: istDay(),
          fromPlace: "Kadodara",
          toPlace: preset?.toPlace ?? "",
          tripId: preset ? String(preset.id) : "",
          gstMode: settings.gstMode,
          gstRate: formatRate(settings.gstRateBp).replace("%", ""),
        }}
      />
    </>
  );
}
