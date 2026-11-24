import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { History } from "@/components/domain/History";
import { Money } from "@/components/domain/Money";
import { RemindButton } from "@/components/domain/RemindButton";
import { Saved } from "@/components/domain/Saved";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { PageHead, Section } from "@/components/ui/PageHead";
import { Pill } from "@/components/ui/Pill";
import { PrintButton } from "@/components/ui/PrintButton";
import { Empty } from "@/components/ui/Rows";
import { Stats } from "@/components/ui/Stats";
import { fill } from "@/content/strings";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PAY_MODES } from "@/lib/types";
import { waLink } from "@/lib/whatsapp";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { getPayment } from "@/server/queries/money";
import { historyOf } from "@/server/queries/audit";
import { getVendorBalance, vendorLedger } from "@/server/queries/vendors";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Party" };

export default async function VendorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; payment?: string }>;
}) {
  await requireAccess("parties.view");
  const id = Number((await params).id);
  const [{ saved, payment: paymentParam }, t, settings, balance, history] = await Promise.all([
    searchParams,
    getT(),
    getSettings(),
    getVendorBalance(id),
    historyOf("vendor", id),
  ]);
  if (!balance) notFound();
  const ledger = await vendorLedger(id, settings.challanPrefix);
  if (!ledger) notFound();
  const { vendor, rows } = ledger;
  const payment = paymentParam ? await getPayment(Number(paymentParam)) : null;
  const receipt =
    payment && payment.vendorId === vendor.id && !payment.isCancelled
      ? fill(t.receipt.text, {
          business: settings.businessName || t.app.name,
          amount: formatMoney(payment.amount),
          name: vendor.name,
          mode: t.modes[payment.mode],
          date: formatDay(payment.paidOn),
          balance: formatMoney(balance.balance),
        })
      : null;
  const modeLabel = (label: string) => PAY_MODES.find((m) => m === label);

  return (
    <>
      <Saved show={saved === "1"} label={t.common.saved} />
      {receipt ? (
        <ButtonAnchor
          href={waLink(vendor.phone, receipt)}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          icon="share"
          className="-mt-2 mb-5"
        >
          {t.receipt.send}
        </ButtonAnchor>
      ) : null}
      <PageHead
        back={{ href: "/vendors", label: t.vendors.title }}
        title={vendor.name}
        sub={[
          t.vendorKinds[vendor.kind],
          vendor.phone,
          vendor.gstin ? `GSTIN ${vendor.gstin}` : "",
          vendor.isActive ? "" : t.common.inactive,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <ButtonLink
              href={`/payments/new?vendor=${vendor.id}`}
              icon="rupee"
              data-tour="record-payment"
            >
              {t.payments.new}
            </ButtonLink>
            {balance.balance > 0 && vendor.phone ? (
              <RemindButton
                t={t}
                name={vendor.name}
                phone={vendor.phone}
                balance={balance.balance}
              />
            ) : null}
          </>
        }
      />
      <div className="grid gap-8">
        <Stats
          items={[
            { label: t.vendors.business, value: formatMoney(balance.business) },
            { label: t.vendors.received, value: formatMoney(balance.received), tone: "in" },
            {
              label: t.vendors.pending,
              value: formatMoney(Math.max(0, balance.balance)),
              tone: balance.balance > 0 ? "due" : "in",
            },
            { label: t.vendors.openingRow, value: formatMoney(balance.openingBalance) },
          ]}
        />

        <Section
          className="scroll-mt-24"
          title={t.vendors.ledger}
          action={
            <div className="flex gap-2" data-no-print>
              <ButtonAnchor
                href={`/api/export/ledger?vendor=${vendor.id}`}
                variant="ghost"
                icon="download"
                className="min-h-11 px-3 text-[14px]"
              >
                {t.common.exportCsv}
              </ButtonAnchor>
              <PrintButton label={t.common.print} variant="secondary" />
            </div>
          }
        >
          {rows.length ? (
            <div
              className="overflow-hidden rounded-card bg-card shadow-card ring-1 ring-rule"
              data-tour="ledger"
            >
              <div className="hidden grid-cols-[110px_1fr_130px_130px_140px] gap-3 border-b border-rule bg-paper/60 px-5 py-2.5 text-[13px] font-semibold text-ink-2 uppercase sm:grid">
                <span>{t.common.date}</span>
                <span />
                <span className="text-right">{t.vendors.charged}</span>
                <span className="text-right">{t.vendors.paid}</span>
                <span className="text-right">{t.vendors.balance}</span>
              </div>
              <ol className="divide-y divide-rule">
                {rows.map((r) => {
                  const mode = r.kind === "payment" ? modeLabel(r.label) : undefined;
                  const label =
                    r.kind === "opening"
                      ? t.vendors.openingRow
                      : mode
                        ? `${t.vendors.paid} · ${t.modes[mode]}`
                        : r.label;
                  return (
                    <li
                      key={r.key}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 px-4 py-3 sm:grid-cols-[110px_1fr_130px_130px_140px] sm:px-5"
                    >
                      <span className="order-2 text-[13px] text-ink-2 sm:order-none sm:text-[15px] sm:text-ink">
                        {r.kind === "opening" ? "—" : formatDay(r.day)}
                      </span>
                      <span className="order-1 min-w-0 truncate text-[15px] font-semibold sm:order-none sm:font-normal">
                        {r.href ? (
                          <Link href={r.href} className="underline-offset-2 hover:underline">
                            {label}
                          </Link>
                        ) : (
                          label
                        )}
                      </span>
                      <span className="num order-3 hidden text-right text-due sm:order-none sm:block">
                        {r.debit ? formatMoney(r.debit) : ""}
                      </span>
                      <span className="num order-4 hidden text-right text-in sm:order-none sm:block">
                        {r.credit ? formatMoney(r.credit) : ""}
                      </span>
                      {/* Phone: one signed figure, the balance under it. */}
                      <span className="num order-1 text-right text-[15px] font-semibold sm:hidden">
                        {r.debit ? (
                          <span className="text-due">+{formatMoney(r.debit)}</span>
                        ) : (
                          <span className="text-in">−{formatMoney(r.credit)}</span>
                        )}
                      </span>
                      <span className="num order-2 text-right text-[13px] text-ink-2 sm:order-none sm:text-[15px] sm:font-semibold sm:text-ink">
                        <span className="sm:hidden">{t.vendors.balance} </span>
                        {formatMoney(r.balance)}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div className="flex items-center justify-between gap-3 border-t border-rule-strong bg-paper/60 px-4 py-3.5 sm:px-5">
                <span className="text-[16px] font-bold">{t.vendors.balance}</span>
                <span className="flex items-center gap-2">
                  {balance.balance > 0 ? <Pill tone="due">{t.vendors.pending}</Pill> : null}
                  <Money
                    paise={balance.balance}
                    tone={balance.balance > 0 ? "due" : "in"}
                    className="text-[18px] font-bold"
                  />
                </span>
              </div>
            </div>
          ) : (
            <Empty>{t.common.nothing}</Empty>
          )}
        </Section>

        <div className="flex flex-wrap gap-2" data-no-print>
          <ButtonLink href={`/vendors/${vendor.id}/edit`} variant="secondary">
            {t.common.edit}
          </ButtonLink>
        </div>
        <History t={t} rows={history} />
      </div>
    </>
  );
}
