"use client";

import { BillPhoto } from "@/components/forms/BillPhoto";
import { FormError } from "@/components/forms/FormError";
import { useForm } from "@/components/forms/useForm";
import { Choice } from "@/components/ui/Choice";
import { Field, MoneyInput, SelectInput, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { PAY_MODES } from "@/lib/types";
import { addExpense } from "@/server/actions/money";

export function ExpenseForm({
  t,
  categories,
  trucks,
  trips,
  initial,
}: {
  t: Pick<Strings, "common" | "expenses" | "modes">;
  categories: { value: string; label: string }[];
  trucks: { id: number; number: string }[];
  trips: { id: number; label: string }[];
  initial: Record<string, string>;
}) {
  const { formAction, v, e, hasErrors } = useForm(addExpense, initial);
  const c = t.common;
  return (
    <form action={formAction} className="grid max-w-xl gap-5">
      <FormError show={hasErrors} message={c.fixErrors} />
      <Field id="amount" label={c.amount} error={e("amount")} c={c}>
        <MoneyInput
          id="amount"
          name="amount"
          defaultValue={v("amount")}
          invalid={Boolean(e("amount"))}
          className="text-[22px] font-semibold"
        />
      </Field>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-[15px] font-semibold">{t.expenses.category}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {categories.map((cat) => (
            <label
              key={cat.value}
              className="flex min-h-12 cursor-pointer items-center justify-center rounded-field bg-card px-2 py-2 text-center text-[15px] font-semibold ring-1 ring-rule-strong has-checked:bg-signal-soft has-checked:ring-2 has-checked:ring-signal has-focus-visible:outline-3 has-focus-visible:outline-signal"
            >
              <input
                type="radio"
                name="category"
                value={cat.value}
                defaultChecked={v("category") === cat.value}
                className="sr-only"
              />
              {cat.label}
            </label>
          ))}
        </div>
        {e("category") ? <p className="text-[14px] font-semibold text-due">{c.required}</p> : null}
      </fieldset>
      <Choice
        name="mode"
        legend={c.mode}
        defaultValue={PAY_MODES.find((m) => m === v("mode")) ?? "cash"}
        options={PAY_MODES.map((m) => ({ value: m, label: t.modes[m] }))}
      />
      <Field id="spentOn" label={c.date} error={e("spentOn")} c={c}>
        <TextInput
          id="spentOn"
          name="spentOn"
          type="date"
          defaultValue={v("spentOn")}
          invalid={Boolean(e("spentOn"))}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="truckId" label={t.expenses.truck} c={c} optional>
          <SelectInput id="truckId" name="truckId" defaultValue={v("truckId")}>
            <option value="">{c.none}</option>
            {trucks.map((tk) => (
              <option key={tk.id} value={tk.id}>
                {tk.number}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="tripId" label={t.expenses.trip} c={c} optional>
          <SelectInput id="tripId" name="tripId" defaultValue={v("tripId")}>
            <option value="">{c.none}</option>
            {trips.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      </div>
      <Field id="note" label={c.note} c={c} optional>
        <TextInput id="note" name="note" defaultValue={v("note")} />
      </Field>
      <BillPhoto
        label={`${t.expenses.photo} · ${c.optional}`}
        help={t.expenses.photoHelp}
        error={e("photo") ? c.invalid : undefined}
      />
      <SubmitButton label={c.save} pendingLabel={c.saving} className="w-full sm:w-auto" />
    </form>
  );
}
