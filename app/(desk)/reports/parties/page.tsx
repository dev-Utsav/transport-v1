import type { Metadata } from "next";
import Link from "next/link";

import { Money } from "@/components/domain/Money";
import { ScoreBadge } from "@/components/domain/ScoreBadge";
import { PageHead } from "@/components/ui/PageHead";
import { Empty } from "@/components/ui/Rows";
import { Segmented } from "@/components/ui/Segmented";
import { ShareBar } from "@/components/ui/ShareBar";
import { fill } from "@/content/strings";
import { istDay, shiftDay } from "@/lib/dates";
import { REPORT_WINDOWS, windowDays } from "@/lib/score";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { partyScorecard } from "@/server/queries/performance";

export const metadata: Metadata = { title: "Party scorecard" };

/** Customers ranked: who pays, who pays on time, who gives business. Every part is shown. */
export default async function PartyScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireAccess("reports.view", "parties.view");
  const days = windowDays((await searchParams).days);
  const today = istDay();
  const [t, rows] = await Promise.all([getT(), partyScorecard(shiftDay(today, -days + 1), today)]);
  const r = t.reports;
  return (
    <>
      <PageHead back={{ href: "/reports", label: r.title }} title={r.parties} sub={r.partiesHelp} />
      <div className="grid gap-5">
        <Segmented
          label={r.period}
          items={REPORT_WINDOWS.map((w) => ({
            href: `/reports/parties?days=${w}`,
            label: fill(r.days, { n: w }),
            active: w === days,
          }))}
        />
        {rows.length ? (
          <ol className="grid gap-3">
            {rows.map((p, i) => (
              <li key={p.id}>
                <Link
                  href={`/vendors/${p.id}`}
                  className="grid gap-3 rounded-card bg-card p-4 ring-1 ring-rule hover:ring-rule-strong sm:p-5"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="text-[13px] font-semibold text-ink-2">#{i + 1}</span>
                      <span className="block truncate text-[17px] font-bold">{p.name}</span>
                    </span>
                    <ScoreBadge score={p.score} band={p.band} bands={r.bands} />
                  </span>
                  <span className="grid gap-2 text-[14px] sm:grid-cols-3 sm:gap-4">
                    <Part label={r.paid} value={p.pays} />
                    <Part label={r.onTime} value={p.onTime} />
                    <Part label={r.business} value={p.business} neutral />
                  </span>
                  <span className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-ink-2">
                    <span>
                      {r.business}: <Money paise={p.billed} className="text-ink" />
                    </span>
                    <span>
                      {r.owes}: <Money paise={Math.max(0, p.balance)} className="text-ink" />
                    </span>
                    {p.oldestDueDays !== null ? (
                      <span>
                        {r.oldestDue}: {fill(r.days, { n: p.oldestDueDays })}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>{r.nothingYet}</Empty>
        )}
        <details className="rounded-card bg-card p-4 text-[15px] ring-1 ring-rule">
          <summary className="cursor-pointer font-semibold">{r.howScore}</summary>
          <p className="mt-2 text-ink-2">{r.partyScoreHow}</p>
        </details>
      </div>
    </>
  );
}

/** One part of the score; `neutral` for size (more business isn't "good", less isn't "bad"). */
function Part({ label, value, neutral }: { label: string; value: number; neutral?: boolean }) {
  return (
    <span className="grid gap-1">
      <span className="text-ink-2">{label}</span>
      <ShareBar
        value={value}
        tone={neutral ? "signal" : value >= 0.75 ? "in" : value >= 0.5 ? "part" : "due"}
        label={`${Math.round(value * 100)}%`}
      />
    </span>
  );
}
