import type { Metadata } from "next";

import { Money } from "@/components/domain/Money";
import { PageHead, Section } from "@/components/ui/PageHead";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { Empty } from "@/components/ui/Rows";
import { ShareBar } from "@/components/ui/ShareBar";
import { categoryLabel } from "@/content/strings";
import { formatMonth, istMonth, isMonth, shiftMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { moneyOverview } from "@/server/queries/performance";

export const metadata: Metadata = { title: "Money in and out" };

/** One month on one screen: the three big numbers, where money came from and went, and the trend. */
export default async function MoneyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireAccess("reports.view");
  const { month: m = "" } = await searchParams;
  const thisMonth = istMonth();
  const month = isMonth(m) && m <= thisMonth ? m : thisMonth;
  const [t, o] = await Promise.all([getT(), moneyOverview(month)]);
  const r = t.reports;
  const left = o.moneyIn - o.moneyOut;
  const outParts = [
    ...o.byCategory.map((c) => ({ key: `c-${c.category}`, label: categoryLabel(t, c.category), v: c.v })),
    { key: "salaries", label: r.salariesPaid, v: o.salaries },
    { key: "advances", label: r.advancesGiven, v: o.advances },
  ]
    .filter((p) => p.v > 0)
    .sort((a, b) => b.v - a.v);
  const peak = Math.max(1, ...o.trend.flatMap((p) => [p.in, p.out]));
  return (
    <>
      <PageHead back={{ href: "/reports", label: r.title }} title={r.money} sub={r.moneyHelp} />
      <div className="grid gap-8">
        <PeriodNav
          label={formatMonth(month)}
          prevHref={`/reports/money?month=${shiftMonth(month, -1)}`}
          nextHref={month < thisMonth ? `/reports/money?month=${shiftMonth(month, 1)}` : null}
          prevLabel={t.common.prev}
          nextLabel={t.common.nextPeriod}
        />

        <dl className="grid gap-3 rounded-card bg-road p-5 text-road-text sm:grid-cols-3">
          <Big label={r.moneyIn} value={formatMoney(o.moneyIn)} />
          <Big label={r.moneyOut} value={formatMoney(o.moneyOut)} />
          <Big
            label={r.leftOver}
            value={`${left < 0 ? "−" : ""}${formatMoney(Math.abs(left))}`}
            strong
          />
          <p className="text-[14px] text-road-muted sm:col-span-3">
            {r.booked}: <span className="num text-road-text">{formatMoney(o.booked)}</span>
          </p>
        </dl>

        <div className="grid gap-8 lg:grid-cols-2">
          <Section title={r.receivedBy}>
            {o.moneyIn > 0 ? (
              <ul className="grid gap-3 rounded-card bg-card p-4 ring-1 ring-rule">
                {o.inByMode.map((p) => (
                  <Line key={p.mode} label={t.modes[p.mode]} v={p.v} share={p.v / o.moneyIn} tone="in" />
                ))}
              </ul>
            ) : (
              <Empty>{r.nothingYet}</Empty>
            )}
          </Section>
          <Section title={r.spentOn}>
            {outParts.length ? (
              <ul className="grid gap-3 rounded-card bg-card p-4 ring-1 ring-rule">
                {outParts.map((p) => (
                  <Line key={p.key} label={p.label} v={p.v} share={p.v / o.moneyOut} tone="due" />
                ))}
              </ul>
            ) : (
              <Empty>{r.nothingYet}</Empty>
            )}
          </Section>
        </div>

        <Section title={r.lastSixMonths}>
          <ul className="grid gap-4 rounded-card bg-card p-4 ring-1 ring-rule">
            {o.trend.map((p) => (
              <li key={p.month} className="grid gap-1.5">
                <span className="text-[15px] font-semibold">{formatMonth(p.month)}</span>
                <span className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 text-[14px]">
                  <span className="text-ink-2">{r.in}</span>
                  <ShareBar value={p.in / peak} tone="in" />
                  <Money paise={p.in} />
                  <span className="text-ink-2">{r.out}</span>
                  <ShareBar value={p.out / peak} tone="due" />
                  <Money paise={p.out} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}

function Big({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[14px] text-road-muted">{label}</dt>
      <dd className={`num font-bold ${strong ? "text-[30px]" : "text-[24px]"}`}>{value}</dd>
    </div>
  );
}

function Line({
  label,
  v,
  share,
  tone,
}: {
  label: string;
  v: number;
  share: number;
  tone: "in" | "due";
}) {
  return (
    <li className="grid gap-1">
      <span className="flex justify-between gap-3 text-[15px]">
        <span className="font-semibold">{label}</span>
        <Money paise={v} />
      </span>
      <ShareBar value={share} tone={tone} label={`${Math.round(share * 100)}%`} />
    </li>
  );
}
