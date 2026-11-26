import type { Metadata } from "next";

import { Money } from "@/components/domain/Money";
import { ScoreBadge } from "@/components/domain/ScoreBadge";
import { PageHead } from "@/components/ui/PageHead";
import { Empty } from "@/components/ui/Rows";
import { Segmented } from "@/components/ui/Segmented";
import { ShareBar } from "@/components/ui/ShareBar";
import type { Strings } from "@/content/strings";
import { fill } from "@/content/strings";
import { istDay, shiftDay } from "@/lib/dates";
import { REPORT_WINDOWS, windowDays } from "@/lib/score";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { tripScorecards } from "@/server/queries/performance";

export const metadata: Metadata = { title: "Drivers, trucks and hired owners" };

const VIEWS = ["drivers", "owners", "trucks"] as const;
type View = (typeof VIEWS)[number];

type Scored = Awaited<ReturnType<typeof tripScorecards>>["drivers"][number];
type TruckRow = Awaited<ReturnType<typeof tripScorecards>>["trucks"][number];

/**
 * Trips since the start of the period, three ways: drivers and hired truck owners ranked by
 * on-time arrival and work done; trucks ranked by profit (freight minus trip expenses).
 */
export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; days?: string }>;
}) {
  await requireAccess("reports.view");
  const sp = await searchParams;
  const view: View = VIEWS.find((v) => v === sp.view) ?? "drivers";
  const days = windowDays(sp.days);
  const [t, cards] = await Promise.all([
    getT(),
    tripScorecards(shiftDay(istDay(), -days + 1)),
  ]);
  const r = t.reports;
  const href = (v: View, d: number) => `/reports/performance?view=${v}&days=${d}`;
  return (
    <>
      <PageHead
        back={{ href: "/reports", label: r.title }}
        title={r.performance}
        sub={r.performanceHelp}
      />
      <div className="grid gap-4">
        <Segmented
          label={r.performance}
          items={VIEWS.map((v) => ({ href: href(v, days), label: r[v], active: v === view }))}
        />
        <Segmented
          label={r.period}
          items={REPORT_WINDOWS.map((w) => ({
            href: href(view, w),
            label: fill(r.days, { n: w }),
            active: w === days,
          }))}
        />
        {view === "trucks" ? (
          <TruckList t={t} rows={cards.trucks} />
        ) : (
          <ScoreList t={t} rows={view === "drivers" ? cards.drivers : cards.owners} />
        )}
        {view === "trucks" ? null : (
          <details className="rounded-card bg-card px-4 text-[15px] ring-1 ring-rule open:pb-4">
            <summary className="cursor-pointer font-semibold">{r.howScore}</summary>
            <p className="mt-2 text-ink-2">{r.deliveryScoreHow}</p>
          </details>
        )}
      </div>
    </>
  );
}

function ScoreList({ t, rows }: { t: Strings; rows: Scored[] }) {
  const r = t.reports;
  if (!rows.length) return <Empty>{r.nothingYet}</Empty>;
  return (
    <ol className="grid gap-3">
      {rows.map((row, i) => (
        <li key={row.key} className="grid gap-3 rounded-card bg-card p-4 ring-1 ring-rule sm:p-5">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="text-[13px] font-semibold text-ink-2">#{i + 1}</span>
              <span className="block truncate text-[17px] font-bold">{row.name}</span>
            </span>
            {row.result ? (
              <ScoreBadge score={row.result.score} band={row.result.band} bands={r.bands} />
            ) : null}
          </span>
          {row.result ? (
            <span className="grid gap-1 text-[14px]">
              <span className="text-ink-2">
                {r.onTime} ({row.onTime}/{row.measured})
                {row.avgLateDays > 0
                  ? ` · ${fill(r.lateBy, { n: Math.round(row.avgLateDays * 10) / 10 })}`
                  : ""}
              </span>
              <ShareBar
                value={row.result.onTime}
                tone={row.result.onTime >= 0.75 ? "in" : row.result.onTime >= 0.5 ? "part" : "due"}
                label={`${Math.round(row.result.onTime * 100)}%`}
              />
            </span>
          ) : (
            <span className="text-[14px] text-ink-2">{r.notMeasured}</span>
          )}
          <span className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-ink-2">
            <span>
              {r.trips}: <span className="num text-ink">{row.trips}</span>
            </span>
            <span>
              {r.freight}: <Money paise={row.freight} className="text-ink" />
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function TruckList({ t, rows }: { t: Strings; rows: TruckRow[] }) {
  const r = t.reports;
  if (!rows.length) return <Empty>{r.nothingYet}</Empty>;
  const top = Math.max(1, ...rows.map((row) => Math.abs(row.profit)));
  return (
    <ol className="grid gap-3">
      {rows.map((row, i) => (
        <li key={row.key} className="grid gap-2 rounded-card bg-card p-4 ring-1 ring-rule sm:p-5">
          <span className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="text-[13px] font-semibold text-ink-2">#{i + 1}</span>
              <span className="block truncate text-[17px] font-bold">{row.name}</span>
            </span>
            <span className="text-right">
              <span className="block text-[13px] text-ink-2">{r.profit}</span>
              <Money paise={row.profit} className="text-[18px] font-bold" />
            </span>
          </span>
          <ShareBar value={Math.abs(row.profit) / top} tone={row.profit >= 0 ? "in" : "due"} />
          <span className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-ink-2">
            <span>
              {r.trips}: <span className="num text-ink">{row.trips}</span>
            </span>
            <span>
              {r.freight}: <Money paise={row.freight} className="text-ink" />
            </span>
            <span>
              {r.spent}: <Money paise={row.spent} className="text-ink" />
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
