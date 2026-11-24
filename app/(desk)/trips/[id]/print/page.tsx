import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Letterhead, Paper } from "@/components/domain/Paper";
import { PageHead } from "@/components/ui/PageHead";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatChallanNo } from "@/lib/challan-no";
import { formatDayFull } from "@/lib/dates";
import { formatAmount, formatMoney } from "@/lib/money";
import { getT } from "@/server/lang";
import { requireAccess, tripScope } from "@/server/auth";
import { getTripDetail } from "@/server/queries/trips";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Loading memo" };

/** Loading memo for the driver: every challan on the truck, packages, and To-Pay money to collect. */
export default async function TripMemoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const actor = await requireAccess("trips.view");
  const [t, settings, detail] = await Promise.all([
    getT(),
    getSettings(),
    getTripDetail(id, tripScope(actor)),
  ]);
  if (!detail) notFound();
  const { trip, groups, totals } = detail;
  const rows = groups.flatMap((g) => g.challans).sort((a, b) => a.no - b.no);
  const toPay = rows.filter((r) => r.payType === "to_pay").reduce((s, r) => s + r.due, 0);
  return (
    <>
      <PageHead
        back={{ href: `/trips/${trip.id}`, label: trip.truckNumber }}
        title={t.tripFlow.manifest}
        actions={<PrintButton label={t.common.print} />}
      />
      <Paper>
        <Letterhead settings={settings} title={t.tripFlow.manifest} fallbackName={t.app.name} />
        <div className="mt-4 grid grid-cols-2 gap-4 border-b border-rule-strong pb-4 sm:grid-cols-4">
          {[
            { label: t.trips.truck, value: <span className="font-mono">{trip.truckNumber}</span> },
            {
              label: t.trips.driver,
              value: [trip.driverName, trip.driverPhone].filter(Boolean).join(" · ") || "—",
            },
            { label: t.trips.route, value: `${trip.fromPlace} → ${trip.toPlace}` },
            { label: t.trips.departOn, value: formatDayFull(trip.departOn) },
          ].map((f) => (
            <div key={f.label}>
              <p className="text-[12px] font-semibold uppercase">{f.label}</p>
              <p className="text-[15px] font-semibold">{f.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b-2 border-ink uppercase">
                <th className="py-2 pr-2">{t.challans.no}</th>
                <th className="py-2 pr-2">{t.challans.sender}</th>
                <th className="py-2 pr-2">{t.challans.receiver}</th>
                <th className="py-2 pr-2 text-right">{t.challans.packages}</th>
                <th className="py-2 pr-2">{t.challans.description}</th>
                <th className="py-2 pr-2">{t.challans.payType}</th>
                <th className="py-2 text-right">{t.tripFlow.toPayTotal}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-rule align-top">
                  <td className="py-2 pr-2 font-mono">
                    {formatChallanNo(r.no, settings.challanPrefix)}
                  </td>
                  <td className="py-2 pr-2">{r.senderName}</td>
                  <td className="py-2 pr-2">{r.receiverName}</td>
                  <td className="num py-2 pr-2 text-right">{r.packages}</td>
                  <td className="py-2 pr-2">{r.description || "—"}</td>
                  <td className="py-2 pr-2">{t.payTypes[r.payType]}</td>
                  <td className="num py-2 text-right">
                    {r.payType === "to_pay" && r.due > 0 ? formatAmount(r.due) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-[14px] font-bold">
                <td colSpan={3} className="pt-3 text-right">
                  {t.common.total}
                </td>
                <td className="num pt-3 text-right">{totals.packages}</td>
                <td colSpan={2} />
                <td className="num pt-3 text-right">{formatMoney(toPay)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <footer className="mt-16 grid grid-cols-2 gap-10 text-center">
          <p className="border-t border-ink pt-2">{t.tripFlow.driverSign}</p>
          <p className="border-t border-ink pt-2">
            {t.challans.signature}
            <br />
            <span className="font-semibold">{settings.businessName}</span>
          </p>
        </footer>
      </Paper>
    </>
  );
}
