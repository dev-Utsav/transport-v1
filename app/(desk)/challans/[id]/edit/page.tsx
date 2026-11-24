import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChallanEditForm } from "@/components/forms/ChallanEditForm";
import { PageHead } from "@/components/ui/PageHead";
import { formatChallanNo } from "@/lib/challan-no";
import { formatDay } from "@/lib/dates";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { getChallan, placeOptions } from "@/server/queries/challans";
import { tripOptions } from "@/server/queries/trips";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Edit challan" };

export default async function EditChallanPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("challans.edit");
  const id = Number((await params).id);
  const [t, settings, data, trips, places] = await Promise.all([
    getT(),
    getSettings(),
    getChallan(id),
    tripOptions(),
    placeOptions(),
  ]);
  if (!data || data.challan.isCancelled) notFound();
  const c = data.challan;
  const tripChoices = trips.map((tr) => ({
    id: tr.id,
    label: `${tr.truckNumber} · ${tr.toPlace} · ${formatDay(tr.departOn)}`,
  }));
  // A challan on a closed trip keeps that trip as an option, so saving doesn't unlink it.
  if (c.tripId && !tripChoices.some((tr) => tr.id === c.tripId)) {
    tripChoices.unshift({ id: c.tripId, label: data.truckNumber ?? String(c.tripId) });
  }
  return (
    <>
      <PageHead
        title={t.common.edit}
        back={{
          href: `/challans/${c.id}`,
          label: `${t.challans.no} ${formatChallanNo(c.no, settings.challanPrefix)}`,
        }}
      />
      <ChallanEditForm
        t={{ common: t.common, challans: t.challans }}
        trips={tripChoices}
        places={places}
        initial={{
          id: String(c.id),
          tripId: c.tripId ? String(c.tripId) : "",
          fromPlace: c.fromPlace,
          toPlace: c.toPlace,
          packages: String(c.packages),
          weightKg: String(c.weightKg),
          description: c.description,
        }}
      />
    </>
  );
}
