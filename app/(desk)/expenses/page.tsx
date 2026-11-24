import type { Metadata } from "next";

import { Money } from "@/components/domain/Money";
import { Saved } from "@/components/domain/Saved";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { PageHead, Section } from "@/components/ui/PageHead";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { Pill } from "@/components/ui/Pill";
import { Empty, RowList, RowLink } from "@/components/ui/Rows";
import { categoryLabel } from "@/content/strings";
import { formatDay, formatMonth, istMonth, isMonth, shiftMonth } from "@/lib/dates";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { expenseBreakdown, listExpenses } from "@/server/queries/money";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; saved?: string }>;
}) {
  await requireAccess("expenses.view");
  const { month: m = "", saved } = await searchParams;
  const thisMonth = istMonth();
  const month = isMonth(m) ? m : thisMonth;
  const [t, rows, breakdown] = await Promise.all([
    getT(),
    listExpenses(month),
    expenseBreakdown(month),
  ]);
  return (
    <>
      <Saved show={saved === "1"} label={t.common.saved} />
      <PageHead
        title={t.expenses.title}
        sub={
          <>
            {t.common.total}: <Money paise={breakdown.total} className="font-semibold text-ink" />
          </>
        }
        actions={
          <>
            <ButtonAnchor
              href={`/api/export/expenses?month=${month}`}
              variant="secondary"
              icon="download"
            >
              {t.common.exportCsv}
            </ButtonAnchor>
            <ButtonLink href="/expenses/new" icon="plus">
              {t.expenses.new}
            </ButtonLink>
          </>
        }
      />
      <div className="grid gap-8">
        <PeriodNav
          label={formatMonth(month)}
          prevHref={`/expenses?month=${shiftMonth(month, -1)}`}
          nextHref={month < thisMonth ? `/expenses?month=${shiftMonth(month, 1)}` : null}
          prevLabel={t.common.prev}
          nextLabel={t.common.nextPeriod}
        />
        {breakdown.byCategory.length ? (
          <Section title={t.expenses.byCategory}>
            <ul className="grid gap-2 rounded-card bg-card p-4 shadow-card ring-1 ring-rule sm:p-5">
              {breakdown.byCategory.map((row) => (
                <li
                  key={row.category}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1"
                >
                  <span className="text-[15px]">{categoryLabel(t, row.category)}</span>
                  <Money paise={row.amount} className="text-[15px] font-semibold" />
                  <span className="col-span-2 h-2 overflow-hidden rounded-full bg-paper-deep">
                    <span
                      className="block h-full origin-left rounded-full bg-signal"
                      style={{ transform: `scaleX(${row.amount / breakdown.total})` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
        <Section title={formatMonth(month)}>
          {rows.length ? (
            <RowList>
              {rows.map((x) => (
                <RowLink
                  key={x.id}
                  href={`/expenses/${x.id}`}
                  muted={x.isCancelled}
                  title={
                    <>
                      {categoryLabel(t, x.category)}
                      {x.note ? <span className="font-normal text-ink-2"> · {x.note}</span> : null}
                    </>
                  }
                  meta={[
                    formatDay(x.spentOn),
                    t.modes[x.mode],
                    x.truckNumber,
                    x.tripTo ? `→ ${x.tripTo}` : "",
                    x.hasPhoto ? "📷" : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  aside={<Money paise={x.amount} />}
                  asideSub={x.isCancelled ? <Pill tone="neutral">{t.common.cancelled}</Pill> : null}
                />
              ))}
            </RowList>
          ) : (
            <Empty>{t.common.nothing}</Empty>
          )}
        </Section>
      </div>
    </>
  );
}
