import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CancelEntry } from "@/components/domain/CancelEntry";
import { FlowBar } from "@/components/domain/FlowBar";
import { History } from "@/components/domain/History";
import { Money } from "@/components/domain/Money";
import { NextStep } from "@/components/domain/NextStep";
import { Saved } from "@/components/domain/Saved";
import { StatusStepper } from "@/components/domain/StatusStepper";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { Card, PageHead, Section } from "@/components/ui/PageHead";
import { COLLECT_TONE, Pill } from "@/components/ui/Pill";
import { Facts, RowList } from "@/components/ui/Rows";
import { Stats } from "@/components/ui/Stats";
import { fill } from "@/content/strings";
import { formatChallanNo } from "@/lib/challan-no";
import { formatDay } from "@/lib/dates";
import { challanNext, challanStage, sortForTruck } from "@/lib/flow";
import { formatRate } from "@/lib/gst";
import { formatMoney } from "@/lib/money";
import { CHALLAN_STATUSES } from "@/lib/types";
import { waLink } from "@/lib/whatsapp";
import { requireAccess } from "@/server/auth";
import { cancelChallan, setChallanStatus } from "@/server/actions/challans";
import { getT } from "@/server/lang";
import { historyOf } from "@/server/queries/audit";
import { getChallan } from "@/server/queries/challans";
import { loadingTrips } from "@/server/queries/flow";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Challan" };

export default async function ChallanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAccess("challans.view");
  const id = Number((await params).id);
  const [{ saved }, t, settings, data, history, loading] = await Promise.all([
    searchParams,
    getT(),
    getSettings(),
    getChallan(id),
    historyOf("challan", id),
    loadingTrips(),
  ]);
  if (!data) notFound();
  const next = challanNext({
    isCancelled: data.challan.isCancelled,
    status: data.challan.status,
    tripId: data.challan.tripId,
    tripStatus: data.trip?.status ?? null,
    due: data.due,
  });
  const stage = challanStage(next);
  const trucksLoading = sortForTruck(
    loading.map((tr) => ({ ...tr, bookedOn: "" })),
    data.challan.toPlace,
  );
  const { challan: c, sender, receiver, trip, truckNumber } = data;
  const no = formatChallanNo(c.no, settings.challanPrefix);
  const party = c.partyId === receiver.id ? receiver : sender;
  const shareText = [
    settings.businessName,
    fill(t.challans.shareText, {
      no,
      from: c.fromPlace,
      to: c.toPlace,
      packages: c.packages,
      total: formatMoney(c.total),
    }),
    `${t.challans.sender}: ${sender.name}`,
    `${t.challans.receiver}: ${receiver.name}`,
    `${t.challans.payType}: ${t.payTypes[c.payType]}`,
    truckNumber ? `${t.trips.truck}: ${truckNumber}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <Saved show={saved === "1"} label={t.common.saved} />
      {stage ? <FlowBar t={t} current={stage} /> : null}
      <PageHead
        back={{ href: "/challans", label: t.challans.title }}
        title={
          <>
            {t.challans.no} <span className="font-mono tracking-wide">{no}</span>
          </>
        }
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {formatDay(c.bookedOn)} · {c.fromPlace} → {c.toPlace}
            {c.isCancelled ? (
              <Pill tone="neutral">{t.common.cancelled}</Pill>
            ) : (
              <Pill tone={COLLECT_TONE[data.state]}>{t.collect[data.state]}</Pill>
            )}
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/challans/${c.id}/print`} variant="secondary" icon="print">
              {t.common.print}
            </ButtonLink>
            <ButtonAnchor
              href={waLink(party.phone, shareText)}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              icon="share"
            >
              {t.common.whatsapp}
            </ButtonAnchor>
          </>
        }
      />

      <div className="grid gap-8">
        <NextStep
          t={t}
          next={next}
          challanId={c.id}
          partyId={party.id}
          truckNumber={truckNumber}
          loading={trucksLoading}
        />
        <Stats
          items={[
            { label: t.challans.total, value: formatMoney(c.total) },
            { label: t.challans.received, value: formatMoney(data.received), tone: "in" },
            {
              label: t.challans.due,
              value: formatMoney(data.due),
              tone: data.due > 0 ? "due" : "in",
            },
            { label: t.challans.payType, value: t.payTypes[c.payType] },
          ]}
        />

        <Card className="grid gap-6 p-5 sm:p-6">
          <Facts
            items={[
              {
                label: t.challans.sender,
                value: (
                  <Link
                    className="font-semibold underline-offset-2 hover:underline"
                    href={`/vendors/${sender.id}`}
                  >
                    {sender.name}
                  </Link>
                ),
              },
              {
                label: t.challans.receiver,
                value: (
                  <Link
                    className="font-semibold underline-offset-2 hover:underline"
                    href={`/vendors/${receiver.id}`}
                  >
                    {receiver.name}
                  </Link>
                ),
              },
              {
                label: t.challans.trip,
                value: trip?.id ? (
                  <Link
                    className="font-mono underline-offset-2 hover:underline"
                    href={`/trips/${trip.id}`}
                  >
                    {truckNumber}
                  </Link>
                ) : (
                  t.challans.noTrip
                ),
              },
              { label: t.challans.packages, value: <span className="num">{c.packages}</span> },
              { label: t.challans.description, value: c.description || "—" },
              {
                label: t.challans.weight,
                value: c.weightKg ? <span className="num">{c.weightKg}</span> : "—",
              },
              { label: t.challans.freight, value: <Money paise={c.freight} /> },
              ...(c.gstAmount > 0
                ? [
                    { label: t.challans.taxable, value: <Money paise={c.taxable} /> },
                    {
                      label: `${t.challans.gstAmount} ${formatRate(c.gstRateBp)}`,
                      value: <Money paise={c.gstAmount} />,
                    },
                  ]
                : []),
            ]}
          />
          {c.isCancelled ? null : (
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/challans/${c.id}/edit`} variant="secondary">
                {t.common.edit}
              </ButtonLink>
              {c.gstAmount > 0 ? (
                <ButtonLink
                  href={`/challans/${c.id}/print?as=invoice`}
                  variant="secondary"
                  icon="print"
                >
                  {t.challans.printInvoice}
                </ButtonLink>
              ) : null}
            </div>
          )}
        </Card>

        {data.payments.length ? (
          <Section title={t.vendors.paid}>
            <RowList>
              {data.payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 px-4 py-3 sm:px-5">
                  <span>
                    {t.modes[p.mode]}{" "}
                    <span className="text-[14px] text-ink-2">· {formatDay(p.paidOn)}</span>
                  </span>
                  <Money paise={p.amount} tone="in" className="font-semibold" />
                </li>
              ))}
            </RowList>
          </Section>
        ) : null}

        {c.isCancelled ? null : (
          <details className="rounded-card px-4 py-3 ring-1 ring-rule sm:px-5" data-no-print>
            <summary className="cursor-pointer text-[15px] font-semibold text-ink-2">
              {t.tripFlow.correct}
            </summary>
            <div className="mt-3">
              <StatusStepper
                id={c.id}
                statuses={CHALLAN_STATUSES}
                current={c.status}
                labels={t.challanStatus}
                legend={t.challans.moveTo}
                action={setChallanStatus}
              />
            </div>
          </details>
        )}
        <History t={t} rows={history} />
        {c.isCancelled ? null : <CancelEntry t={t} id={c.id} action={cancelChallan} />}
      </div>
    </>
  );
}
