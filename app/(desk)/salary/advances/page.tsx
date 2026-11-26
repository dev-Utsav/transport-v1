import type { Metadata } from "next";

import { Money } from "@/components/domain/Money";
import { Saved } from "@/components/domain/Saved";
import { AdvanceForm } from "@/components/forms/AdvanceForm";
import { PageHead, Section } from "@/components/ui/PageHead";
import { PeriodNav } from "@/components/ui/PeriodNav";
import { Pill } from "@/components/ui/Pill";
import { Empty, RowList, RowLink } from "@/components/ui/Rows";
import { formatDay, istDay, isDay, shiftDay } from "@/lib/dates";
import { can, requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { advancesOnDay, payrollStaff } from "@/server/queries/salary";

export const metadata: Metadata = { title: "Advances" };

/**
 * Office work: cash advances, many a day. The form sits on top and comes back empty after each
 * save; below it, everything given that day with the day's total.
 */
export default async function AdvancesPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; saved?: string; staff?: string }>;
}) {
  const actor = await requireAccess("advances.record");
  const { day: d = "", saved = "", staff = "" } = await searchParams;
  const today = istDay();
  const day = isDay(d) && d <= today ? d : today;
  const [t, people, rows] = await Promise.all([getT(), payrollStaff(), advancesOnDay(day)]);
  const total = rows.reduce((s, r) => s + (r.advance.isCancelled ? 0 : r.advance.amount), 0);
  return (
    <>
      <Saved show={saved !== ""} label={t.common.saved} />
      <PageHead
        back={
          can(actor, "salary.view")
            ? { href: "/salary", label: t.salary.title }
            : { href: "/", label: t.nav.home }
        }
        title={t.salary.advances}
        sub={t.salary.advancesHelp}
      />
      <div className="grid gap-8">
        <AdvanceForm
          key={saved}
          t={{ common: t.common, salary: t.salary, modes: t.modes, roles: t.roles }}
          people={people}
          initial={{
            staffId: staff,
            givenOn: day,
            mode: "cash",
            // Opened from a person's salary page: go back there after saving.
            ...(/^\d+$/.test(staff) ? { back: `/salary/${staff}?month=${day.slice(0, 7)}` } : {}),
          }}
        />
        <Section
          title={t.salary.dayTotal}
          action={<Money paise={total} className="text-[18px] font-bold" />}
        >
          <div className="grid gap-4">
            <PeriodNav
              label={formatDay(day, today)}
              prevHref={`/salary/advances?day=${shiftDay(day, -1)}`}
              nextHref={day < today ? `/salary/advances?day=${shiftDay(day, 1)}` : null}
              prevLabel={t.common.prev}
              nextLabel={t.common.nextPeriod}
            />
            {rows.length ? (
              <RowList>
                {rows.map(({ advance, name }) => (
                  <RowLink
                    key={advance.id}
                    href={`/salary/${advance.staffId}?month=${advance.givenOn.slice(0, 7)}`}
                    muted={advance.isCancelled}
                    title={name}
                    meta={[t.modes[advance.mode], advance.note].filter(Boolean).join(" · ")}
                    aside={<Money paise={advance.amount} />}
                    asideSub={
                      advance.isCancelled ? <Pill tone="neutral">{t.common.cancelled}</Pill> : null
                    }
                  />
                ))}
              </RowList>
            ) : (
              <Empty>{t.salary.noAdvances}</Empty>
            )}
          </div>
        </Section>
      </div>
    </>
  );
}
