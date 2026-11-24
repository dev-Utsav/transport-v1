"use client";

import { FormError } from "@/components/forms/FormError";
import { useForm } from "@/components/forms/useForm";
import { Choice } from "@/components/ui/Choice";
import { Field, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { TRUCK_OWNERS } from "@/lib/types";
import { saveDriver, saveTruck } from "@/server/actions/masters";

const BOX = "grid gap-4 rounded-card bg-card p-5 shadow-card ring-1 ring-rule";

export function TruckForm({
  t,
  initial,
}: {
  t: Pick<Strings, "common" | "settings" | "owners">;
  initial: Record<string, string>;
}) {
  const { state, formAction, v, e } = useForm(saveTruck, initial);
  const c = t.common;
  return (
    <form action={formAction} className={BOX}>
      <FormError state={state} c={c} />
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="number" label={t.settings.truckNo} error={e("number")} c={c}>
          <TextInput
            id="number"
            name="number"
            className="font-mono uppercase"
            placeholder="GJ06AB1234"
            defaultValue={v("number")}
            invalid={Boolean(e("number"))}
          />
        </Field>
        <Field id="type" label={t.settings.truckType} c={c} optional>
          <TextInput id="type" name="type" defaultValue={v("type")} />
        </Field>
      </div>
      <Choice
        name="owner"
        legend={t.owners.own + " / " + t.owners.hired}
        columns={2}
        defaultValue={TRUCK_OWNERS.find((o) => o === v("owner")) ?? "own"}
        options={TRUCK_OWNERS.map((o) => ({ value: o, label: t.owners[o] }))}
      />
      <Field id="ownerName" label={t.settings.ownerName} c={c} optional>
        <TextInput id="ownerName" name="ownerName" defaultValue={v("ownerName")} />
      </Field>
      <SubmitButton label={c.save} pendingLabel={c.saving} className="sm:justify-self-start" />
    </form>
  );
}

export function DriverForm({
  t,
  initial,
}: {
  t: Pick<Strings, "common" | "settings">;
  initial: Record<string, string>;
}) {
  const { state, formAction, v, e } = useForm(saveDriver, initial);
  const c = t.common;
  return (
    <form action={formAction} className={BOX}>
      <FormError state={state} c={c} />
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="name" label={c.name} error={e("name")} c={c}>
          <TextInput id="name" name="name" defaultValue={v("name")} invalid={Boolean(e("name"))} />
        </Field>
        <Field id="phone" label={c.phone} error={e("phone")} c={c} optional>
          <TextInput
            id="phone"
            name="phone"
            type="tel"
            defaultValue={v("phone")}
            invalid={Boolean(e("phone"))}
          />
        </Field>
        <Field id="licence" label={t.settings.licence} c={c} optional>
          <TextInput
            id="licence"
            name="licence"
            className="uppercase"
            defaultValue={v("licence")}
          />
        </Field>
      </div>
      <SubmitButton label={c.save} pendingLabel={c.saving} className="sm:justify-self-start" />
    </form>
  );
}
