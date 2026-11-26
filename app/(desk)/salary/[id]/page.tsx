import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Saved } from "@/components/domain/Saved";
import { Money } from "@/components/domain/Money";
import { SalaryForm } from "@/components/forms/SalaryForm";
import { ButtonLink } from "@/components/ui/Button";
import { PageHead, Section } from "@/components/ui/PageHead";
import { Pill } from "@/components/ui/Pill";
import { Empty } from "@/components/ui/Rows";
import type { Strings } from "@/content/strings";
import { daysInMonth, formatDay, formatMonth, istDay, istMonth, isMonth } from "@/lib/dates";
import { formatMoney, paiseToInput } from "@/lib/money";
import { cancelAdvance } from "@/server/actions/advances";
import { can, requireAccess } from "@/server/auth";
import type { staffAdvances } from "@/server/db/schema";
import { getT } from "@/server/lang";
import {
  advancesInMonth,
  getAdvanceOwed,
  getEmployee,
  getSalaryEntry,
} from "@/server/queries/salary";

export const metadata: Metadata = { title: "Salary entry" };

export default async function SalaryEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; saved?: string }>;
}) {
  const actor = await requireAccess("salary.view");
  const id = Number((await params).id);
  const { month: m = "", saved } = await searchParams;
  const month = isMonth(m) ? m : istMonth();
  const [t, employee, entry, advance, khata] = await Promise.all([
    getT(),
    getEmployee(id),
    getSalaryEntry(id, month),
    getAdvanceOwed(id, month),
    advancesInMonth(id, month),
  ]);
  if (!employee) notFound();
  const isPaid = Boolean(entry?.paidOn);
  // A paid month keeps what it took off; the khata can't change under a paid slip.
  const advanceOwed = isPaid && entry ? entry.advance : advance.owed;
  const canGive = can(actor, "advances.record") && employee.onPayroll && employee.isActive;
  const canCancel = can(actor, "advances.cancel") && !isPaid;
  return (
    <>
      <Saved show={saved === "1"} label={t.common.saved} />
      <PageHead
        back={{ href: `/salary?month=${month}`, label: t.salary.title }}
        title={employee.name}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {t.roles[employee.role]} · {formatMonth(month)}
            {entry?.paidOn && entry.paidMode ? (
              <Pill tone="in">
                {t.salary.paid} · {formatMoney(entry.paidAmount ?? 0)} · {t.modes[entry.paidMode]} ·{" "}
                {formatDay(entry.paidOn)}
              </Pill>
            ) : null}
          </span>
        }
        actions={
          <>
            {entry ? (
              <ButtonLink
                href={`/salary/${id}/slip?month=${month}`}
                variant="secondary"
                icon="print"
              >
                {t.salary.slip}
              </ButtonLink>
            ) : null}
            <ButtonLink href={`/salary/staff/${id}`} variant="secondary">
              {t.common.edit}
            </ButtonLink>
          </>
        }
      />
      <SalaryForm
        t={{ common: t.common, salary: t.salary, modes: t.modes }}
        monthlySalary={entry?.monthlySalary ?? employee.monthlySalary}
        advanceOwed={advanceOwed}
        month={month}
        isPaid={isPaid}
        initial={{
          staffId: String(id),
          present: String(entry?.present ?? daysInMonth(month)),
          absent: String(entry?.absent ?? 0),
          halfDays: String(entry?.halfDays ?? 0),
          deduction: paiseToInput(entry?.deduction ?? 0),
          note: entry?.note ?? "",
          paidOn: istDay(),
        }}
      />
      <Section
        className="mt-10 max-w-xl"
        title={t.salary.advancesThisMonth}
        action={
          canGive ? (
            <ButtonLink href={`/salary/advances?staff=${id}`} variant="secondary" icon="plus">
              {t.salary.giveAdvance}
            </ButtonLink>
          ) : null
        }
      >
        <p className="text-[15px] text-ink-2">
          {t.salary.owed}: <Money paise={advance.owed} className="font-semibold text-ink" />
        </p>
        {khata.length ? (
          <ul className="grid divide-y divide-rule rounded-card bg-card ring-1 ring-rule">
            {khata.map((a) => (
              <KhataRow key={a.id} t={t} advance={a} canCancel={canCancel} />
            ))}
          </ul>
        ) : (
          <Empty>{t.salary.noAdvances}</Empty>
        )}
      </Section>
    </>
  );
}

/** One advance: day, mode, note, amount; admin can cancel it with two taps until the month is paid. */
function KhataRow({
  t,
  advance,
  canCancel,
}: {
  t: Strings;
  advance: typeof staffAdvances.$inferSelect;
  canCancel: boolean;
}) {
  return (
    <li className={`grid gap-2 px-4 py-3 sm:px-5 ${advance.isCancelled ? "opacity-60" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px]">
          <span className="font-semibold">{formatDay(advance.givenOn)}</span>
          <span className="text-ink-2">
            {" · "}
            {[t.modes[advance.mode], advance.note].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {advance.isCancelled ? <Pill tone="neutral">{t.common.cancelled}</Pill> : null}
          <Money paise={advance.amount} className="font-semibold" />
        </span>
      </div>
      {canCancel && !advance.isCancelled ? (
        <details className="text-[14px]" data-no-print>
          <summary className="cursor-pointer font-semibold text-due">
            {t.common.cancelRecord}
          </summary>
          <form action={cancelAdvance} className="mt-2 flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={advance.id} />
            <span className="text-ink-2">{t.common.cancelConfirm}</span>
            <button className="min-h-11 rounded-field bg-due px-4 font-semibold text-card">
              {t.common.cancelRecord}
            </button>
          </form>
        </details>
      ) : null}
    </li>
  );
}
