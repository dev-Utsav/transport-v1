"use client";

import { FormError } from "@/components/forms/FormError";
import { useForm } from "@/components/forms/useForm";
import { Choice } from "@/components/ui/Choice";
import { Field, MoneyInput, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { STAFF_ROLES } from "@/lib/types";
import { saveEmployee } from "@/server/actions/masters";

export function EmployeeForm({
  t,
  initial,
}: {
  t: Pick<Strings, "common" | "salary" | "roles">;
  initial: Record<string, string>;
}) {
  const { state, formAction, v, e } = useForm(saveEmployee, initial);
  const c = t.common;
  return (
    <form action={formAction} className="grid max-w-xl gap-5">
      <FormError state={state} c={c} />
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Field id="name" label={c.name} error={e("name")} c={c}>
        <TextInput id="name" name="name" defaultValue={v("name")} invalid={Boolean(e("name"))} />
      </Field>
      <Choice
        name="role"
        legend={t.salary.role}
        defaultValue={STAFF_ROLES.find((r) => r === v("role"))}
        options={STAFF_ROLES.map((r) => ({ value: r, label: t.roles[r] }))}
        error={e("role") ? c.required : undefined}
      />
      <Field id="monthlySalary" label={t.salary.monthly} error={e("monthlySalary")} c={c}>
        <MoneyInput
          id="monthlySalary"
          name="monthlySalary"
          defaultValue={v("monthlySalary")}
          invalid={Boolean(e("monthlySalary"))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="joinedOn" label={t.salary.joined} error={e("joinedOn")} c={c}>
          <TextInput
            id="joinedOn"
            name="joinedOn"
            type="date"
            defaultValue={v("joinedOn")}
            invalid={Boolean(e("joinedOn"))}
          />
        </Field>
        <Field id="phone" label={c.phone} error={e("phone")} c={c} optional>
          <TextInput id="phone" name="phone" type="tel" inputMode="tel" defaultValue={v("phone")} />
        </Field>
      </div>
      <SubmitButton label={c.save} pendingLabel={c.saving} className="w-full sm:w-auto" />
    </form>
  );
}
