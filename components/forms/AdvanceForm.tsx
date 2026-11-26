"use client";

import { FormError } from "@/components/forms/FormError";
import { useForm } from "@/components/forms/useForm";
import { Choice } from "@/components/ui/Choice";
import { Field, MoneyInput, SelectInput, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { PAY_MODES } from "@/lib/types";
import { giveAdvance } from "@/server/actions/advances";

/** Cash advance to a worker: person, amount, done. Mode and date default to cash, today. */
export function AdvanceForm({
  t,
  people,
  initial,
}: {
  t: Pick<Strings, "common" | "salary" | "modes" | "roles">;
  people: { id: number; name: string; role: keyof Strings["roles"] }[];
  initial: Record<string, string>;
}) {
  const { state, formAction, v, e } = useForm(giveAdvance, initial);
  const c = t.common;
  return (
    <form action={formAction} className="grid max-w-xl gap-5">
      <FormError state={state} c={c} />
      {initial.back ? <input type="hidden" name="back" value={initial.back} /> : null}
      <Field id="staffId" label={t.salary.person} error={e("staffId")} c={c}>
        <SelectInput
          id="staffId"
          name="staffId"
          defaultValue={v("staffId")}
          invalid={Boolean(e("staffId"))}
        >
          <option value="">{c.choose}</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {t.roles[p.role]}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field id="amount" label={c.amount} error={e("amount")} c={c}>
        <MoneyInput
          id="amount"
          name="amount"
          defaultValue={v("amount")}
          invalid={Boolean(e("amount"))}
          className="text-[22px] font-semibold"
        />
      </Field>
      <Choice
        name="mode"
        legend={c.mode}
        defaultValue={PAY_MODES.find((m) => m === v("mode")) ?? "cash"}
        options={PAY_MODES.map((m) => ({ value: m, label: t.modes[m] }))}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="givenOn" label={t.salary.givenOn} error={e("givenOn")} c={c}>
          <TextInput
            id="givenOn"
            name="givenOn"
            type="date"
            defaultValue={v("givenOn")}
            invalid={Boolean(e("givenOn"))}
          />
        </Field>
        <Field id="note" label={c.note} c={c} optional>
          <TextInput id="note" name="note" defaultValue={v("note")} />
        </Field>
      </div>
      <SubmitButton
        label={t.salary.giveAdvance}
        pendingLabel={c.saving}
        className="w-full sm:w-auto"
      />
    </form>
  );
}
