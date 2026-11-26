import type { Metadata } from "next";

import { Money } from "@/components/domain/Money";
import { Saved } from "@/components/domain/Saved";
import { ButtonAnchor, ButtonLink } from "@/components/ui/Button";
import { PageHead } from "@/components/ui/PageHead";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { Pill } from "@/components/ui/Pill";
import { Empty, RowList, RowLink } from "@/components/ui/Rows";
import { formatMonth, istMonth, isMonth, shiftMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { salaryRegister } from "@/server/queries/salary";

export const metadata: Metadata = { title: "Salary" };

export default async function SalaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; saved?: string }>;
}) {
  await requireAccess("salary.view");
  const { month: m = "", saved } = await searchParams;
  const thisMonth = istMonth();
  const month = isMonth(m) ? m : thisMonth;
  const [t, rows] = await Promise.all([getT(), salaryRegister(month)]);
  const totalNet = rows.reduce((s, r) => s + (r.pay?.net ?? 0), 0);
  return (
    <>
      <Saved show={saved === "1"} label={t.common.saved} />
      <PageHead
        title={t.salary.title}
        sub={
          <>
            {t.salary.net}: <Money paise={totalNet} className="font-semibold text-ink" />
          </>
        }
        actions={
          <>
            <ButtonLink href="/salary/advances" variant="secondary" icon="rupee">
              {t.salary.advances}
            </ButtonLink>
            <ButtonLink href={`/salary/register?month=${month}`} variant="secondary" icon="print">
              {t.salary.register}
            </ButtonLink>
            <ButtonAnchor
              href={`/api/export/salary?month=${month}`}
              variant="secondary"
              icon="download"
            >
              {t.common.exportCsv}
            </ButtonAnchor>
            <ButtonLink href="/salary/staff/new" icon="plus">
              {t.salary.newEmployee}
            </ButtonLink>
          </>
        }
      />
      <div className="grid gap-6">
        <PeriodNav
          label={formatMonth(month)}
          prevHref={`/salary?month=${shiftMonth(month, -1)}`}
          nextHref={month < thisMonth ? `/salary?month=${shiftMonth(month, 1)}` : null}
          prevLabel={t.common.prev}
          nextLabel={t.common.nextPeriod}
        />
        {rows.length ? (
          <RowList>
            {rows.map(({ employee, entry, pay, advanceOwed }) => (
              <RowLink
                key={employee.id}
                href={`/salary/${employee.id}?month=${month}`}
                muted={!employee.isActive}
                title={employee.name}
                meta={[
                  t.roles[employee.role],
                  pay ? `${t.salary.paidDays}: ${pay.paidDays}/${pay.totalDays}` : t.salary.entry,
                  advanceOwed > 0 ? `${t.salary.owed}: ${formatMoney(advanceOwed)}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
                aside={pay ? <Money paise={pay.net} /> : "—"}
                asideSub={
                  entry?.paidOn ? (
                    <Pill tone="in">{t.salary.paid}</Pill>
                  ) : (
                    <Pill tone={entry ? "part" : "neutral"}>{t.salary.unpaid}</Pill>
                  )
                }
              />
            ))}
          </RowList>
        ) : (
          <Empty>{t.common.nothing}</Empty>
        )}
      </div>
    </>
  );
}
