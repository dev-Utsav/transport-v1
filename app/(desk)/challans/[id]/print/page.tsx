import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Letterhead, Paper } from "@/components/domain/Paper";
import { PageHead } from "@/components/ui/PageHead";
import { PrintButton } from "@/components/ui/PrintButton";
import { formatChallanNo } from "@/lib/challan-no";
import { formatDayFull } from "@/lib/dates";
import { formatRate } from "@/lib/gst";
import { formatAmount, formatMoney } from "@/lib/money";
import { amountInWords } from "@/lib/words";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { getChallan } from "@/server/queries/challans";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Print challan" };

/**
 * Printable challan (bilty) or tax invoice, A4. Layout follows a common paper bilty; it will be
 * matched to the client's own format once they share it (open point in PROGRESS.md).
 */
export default async function PrintChallanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  await requireAccess("challans.view");
  const id = Number((await params).id);
  const [{ as }, t, settings, data] = await Promise.all([
    searchParams,
    getT(),
    getSettings(),
    getChallan(id),
  ]);
  if (!data) notFound();
  const { challan: c, sender, receiver, truckNumber } = data;
  const isInvoice = as === "invoice" && c.gstAmount > 0;
  const no = formatChallanNo(c.no, settings.challanPrefix);
  const party = c.partyId === receiver.id ? receiver : sender;

  return (
    <>
      <PageHead
        back={{ href: `/challans/${c.id}`, label: `${t.challans.no} ${no}` }}
        title={isInvoice ? t.challans.printInvoice : t.challans.printChallan}
        actions={<PrintButton label={t.common.print} />}
      />
      <Paper>
        <Letterhead
          settings={settings}
          title={isInvoice ? t.challans.invoice : t.challans.docTitle}
          fallbackName={t.app.name}
        />

        <div className="mt-4 grid grid-cols-3 gap-4 border-b border-rule-strong pb-4">
          <div>
            <p className="text-[12px] font-semibold uppercase">{t.challans.no}</p>
            <p className="font-mono text-[18px] font-medium">{no}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase">{t.common.date}</p>
            <p className="text-[16px] font-semibold">{formatDayFull(c.bookedOn)}</p>
          </div>
          <div>
            <p className="text-[12px] font-semibold uppercase">{t.trips.truck}</p>
            <p className="font-mono text-[16px] font-medium">{truckNumber ?? "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-b border-rule-strong py-4">
          {[
            {
              title: isInvoice
                ? `Bill to · ${party === sender ? t.challans.consignor : t.challans.consignee}`
                : t.challans.consignor,
              p: isInvoice ? party : sender,
              place: c.fromPlace,
            },
            {
              title: t.challans.consignee,
              p: isInvoice ? (party === sender ? receiver : sender) : receiver,
              place: c.toPlace,
            },
          ].map((box) => (
            <section key={box.title} data-keep className="grid gap-0.5">
              <p className="text-[12px] font-semibold uppercase">{box.title}</p>
              <p className="text-[16px] font-bold">{box.p.name}</p>
              {box.p.address ? <p>{box.p.address}</p> : null}
              <p>
                {[box.p.phone, box.p.gstin ? `GSTIN ${box.p.gstin}` : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-1 font-semibold">{box.place}</p>
            </section>
          ))}
        </div>

        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-ink text-[12px] uppercase">
              <th className="py-2 pr-2">{t.challans.packages}</th>
              <th className="py-2 pr-2">{t.challans.description}</th>
              <th className="py-2 pr-2 text-right">{t.challans.weight}</th>
              <th className="py-2 text-right">{t.challans.freight}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-rule-strong align-top">
              <td className="num py-3 pr-2 text-[16px] font-semibold">{c.packages}</td>
              <td className="py-3 pr-2">{c.description || "—"}</td>
              <td className="num py-3 pr-2 text-right">{c.weightKg || "—"}</td>
              <td className="num py-3 text-right">
                {formatAmount(c.gstMode === "included" ? c.taxable : c.freight)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            {c.gstAmount > 0 ? (
              <>
                <tr>
                  <td colSpan={3} className="pt-3 text-right">
                    {t.challans.taxable}
                  </td>
                  <td className="num pt-3 text-right">{formatAmount(c.taxable)}</td>
                </tr>
                <tr>
                  <td colSpan={3} className="text-right">
                    GST {formatRate(c.gstRateBp)}
                  </td>
                  <td className="num text-right">{formatAmount(c.gstAmount)}</td>
                </tr>
              </>
            ) : null}
            <tr className="text-[18px] font-bold">
              <td colSpan={3} className="pt-2 text-right">
                {t.challans.total}
              </td>
              <td className="num pt-2 text-right">{formatMoney(c.total)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-right italic">{amountInWords(c.total)}</p>

        <div className="mt-6 flex items-center gap-3">
          <span className="rounded-md border-2 border-ink px-4 py-1.5 text-[18px] font-bold tracking-wide uppercase">
            {t.payTypes[c.payType]}
          </span>
          <span>{t.payTypeHelp[c.payType]}</span>
        </div>

        <footer className="mt-16 grid grid-cols-2 gap-10 text-center">
          <p className="border-t border-ink pt-2">{t.challans.receiverSign}</p>
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
