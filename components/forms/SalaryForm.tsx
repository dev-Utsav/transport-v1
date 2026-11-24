"use client";

import { useState } from "react";

import { FormError } from "@/components/forms/FormError";
import { useForm } from "@/components/forms/useForm";
import { Choice } from "@/components/ui/Choice";
import { Field, MoneyInput, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { formatMoney, parseRupees } from "@/lib/money";
import { calcSalary } from "@/lib/salary";
import { PAY_MODES } from "@/lib/types";
import { saveSalaryEntry } from "@/server/actions/salary";

const NUMBER_FIELDS = ["present", "absent", "halfDays"] as const;

/** Attendance, advance and deductions with the net worked out live (same function as the server). */
export function SalaryForm({
  t,
  monthlySalary,
  month,
  isPaid,
  initial,
}: {
  t: Pick<Strings, "common" | "salary" | "modes">;
  monthlySalary: number;
  month: string;
  isPaid: boolean;
  initial: Record<string, string>;
}) {
  const { state, formAction, v, e } = useForm(saveSalaryEntry, initial);
  const c = t.common;
  const [live, setLive] = useState(() => readLive(initial));

  function readLive(values: Record<string, string>) {
    const int = (name: string) => Math.max(0, Math.floor(Number(values[name]) || 0));
    return calcSalary({
      monthlySalary,
      month,
      present: int("present"),
      halfDays: int("halfDays"),
      advance: parseRupees(values.advance ?? "") ?? 0,
      deduction: parseRupees(values.deduction ?? "") ?? 0,
    });
  }

  function onInput(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const [key, value] of data) if (typeof value === "string") values[key] = value;
    setLive(readLive(values));
  }

  return (
    <form action={formAction} onInput={onInput} className="grid max-w-xl gap-5">
      <FormError state={state} c={c} />
      <input type="hidden" name="staffId" value={initial.staffId} />
      <input type="hidden" name="month" value={month} />
      <div className="grid grid-cols-3 gap-3">
        {NUMBER_FIELDS.map((name) => (
          <Field
            key={name}
            id={name}
            label={
              { present: t.salary.present, absent: t.salary.absent, halfDays: t.salary.half }[name]
            }
            error={e(name)}
            c={c}
          >
            <TextInput
              id={name}
              name={name}
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={v(name)}
              invalid={Boolean(e(name))}
              className="text-center text-[20px] font-semibold"
            />
          </Field>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="advance" label={t.salary.advance} error={e("advance")} c={c}>
          <MoneyInput
            id="advance"
            name="advance"
            defaultValue={v("advance")}
            invalid={Boolean(e("advance"))}
          />
        </Field>
        <Field id="deduction" label={t.salary.deduction} error={e("deduction")} c={c}>
          <MoneyInput
            id="deduction"
            name="deduction"
            defaultValue={v("deduction")}
            invalid={Boolean(e("deduction"))}
          />
        </Field>
      </div>
      <Field id="note" label={c.note} c={c} optional>
        <TextInput id="note" name="note" defaultValue={v("note")} />
      </Field>

      <dl className="grid gap-1.5 rounded-card bg-road p-5 text-road-text" aria-live="polite">
        <div className="flex justify-between text-[15px]">
          <dt className="text-road-muted">{t.salary.monthly}</dt>
          <dd className="num">{formatMoney(monthlySalary)}</dd>
        </div>
        <div className="flex justify-between text-[15px]">
          <dt className="text-road-muted">
            {t.salary.paidDays} ({live.paidDays} / {live.totalDays})
          </dt>
          <dd className="num">{formatMoney(live.earned)}</dd>
        </div>
        <div className="mt-1 flex items-baseline justify-between border-t border-road-2 pt-2">
          <dt className="text-[16px] font-semibold">{t.salary.net}</dt>
          <dd className="num text-[28px] font-bold">{formatMoney(live.net)}</dd>
        </div>
      </dl>

      {isPaid ? null : (
        <details
          className="grid gap-4 rounded-card bg-card p-4 ring-1 ring-rule"
          open={v("markPaid") === "yes"}
        >
          <summary className="cursor-pointer text-[16px] font-semibold">
            {t.salary.markPaid}
          </summary>
          <div className="mt-4 grid gap-4">
            <label className="flex min-h-12 items-center gap-3 text-[16px]">
              <input
                type="checkbox"
                name="markPaid"
                value="yes"
                defaultChecked={v("markPaid") === "yes"}
                className="size-6"
              />
              {t.salary.markPaid}
            </label>
            <Choice
              name="paidMode"
              legend={c.mode}
              defaultValue={PAY_MODES.find((m) => m === v("paidMode"))}
              options={PAY_MODES.map((m) => ({ value: m, label: t.modes[m] }))}
              error={e("paidMode") ? c.required : undefined}
            />
            <Field id="paidOn" label={t.salary.paidOn} error={e("paidOn")} c={c}>
              <TextInput
                id="paidOn"
                name="paidOn"
                type="date"
                defaultValue={v("paidOn")}
                invalid={Boolean(e("paidOn"))}
              />
            </Field>
          </div>
        </details>
      )}
      <SubmitButton label={c.save} pendingLabel={c.saving} className="w-full sm:w-auto" />
    </form>
  );
}
