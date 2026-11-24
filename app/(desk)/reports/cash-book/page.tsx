import type { Metadata } from "next";

import { Money } from "@/components/domain/Money";
import { ReportActions } from "@/components/domain/ReportActions";
import { PageHead, Section } from "@/components/ui/PageHead";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { RowList } from "@/components/ui/Rows";
import { Stats } from "@/components/ui/Stats";
import { categoryLabel } from "@/content/strings";
import { formatDayFull, istDay, isDay, shiftDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { cashBook } from "@/server/queries/reports";

export const metadata: Metadata = { title: "Cash book" };

export default async function CashBookPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  await requireAccess("reports.view");
  const { day: d = "" } = await searchParams;
  const today = istDay();
  const day = isDay(d) && d <= today ? d : today;
  const [t, book] = await Promise.all([getT(), cashBook(day)]);
  const outRows = [
    ...book.outs.map((o) => ({
      key: `e${o.id}`,
      label: categoryLabel(t, o.category),
      note: o.note,
      amount: o.amount,
    })),
    ...book.sals.map((s) => ({
      key: `s${s.id}`,
      label: t.salary.title,
      note: s.name,
      amount: s.amount,
    })),
  ];
  return (
    <>
      <PageHead
        back={{ href: "/reports", label: t.reports.title }}
        title={t.reports.cashBook}
        actions={<ReportActions t={t} csvHref={`/api/export/cash-book?day=${day}`} />}
      />
      <div className="grid gap-6">
        <PeriodNav
          label={formatDayFull(day)}
          prevHref={`/reports/cash-book?day=${shiftDay(day, -1)}`}
          nextHref={day < today ? `/reports/cash-book?day=${shiftDay(day, 1)}` : null}
          prevLabel={t.common.prev}
          nextLabel={t.common.nextPeriod}
        />
        <Stats
          items={[
            { label: t.reports.opening, value: formatMoney(book.opening) },
            { label: t.reports.cashIn, value: formatMoney(book.cashIn), tone: "in" },
            { label: t.reports.cashOut, value: formatMoney(book.cashOut), tone: "due" },
            { label: t.reports.closing, value: formatMoney(book.closing) },
          ]}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title={t.reports.cashIn}>
            <RowList>
              {book.ins.length ? (
                book.ins.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3 px-4 py-3 sm:px-5">
                    <span className="min-w-0 truncate">
                      {r.name}
                      {r.note ? <span className="text-ink-2"> · {r.note}</span> : null}
                    </span>
                    <Money paise={r.amount} tone="in" className="font-semibold" />
                  </li>
                ))
              ) : (
                <li className="px-4 py-3 text-ink-2 sm:px-5">—</li>
              )}
            </RowList>
          </Section>
          <Section title={t.reports.cashOut}>
            <RowList>
              {outRows.length ? (
                outRows.map((r) => (
                  <li key={r.key} className="flex justify-between gap-3 px-4 py-3 sm:px-5">
                    <span className="min-w-0 truncate">
                      {r.label}
                      {r.note ? <span className="text-ink-2"> · {r.note}</span> : null}
                    </span>
                    <Money paise={r.amount} tone="due" className="font-semibold" />
                  </li>
                ))
              ) : (
                <li className="px-4 py-3 text-ink-2 sm:px-5">—</li>
              )}
            </RowList>
          </Section>
        </div>
      </div>
    </>
  );
}
