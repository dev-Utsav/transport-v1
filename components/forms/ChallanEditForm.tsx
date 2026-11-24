"use client";

import { FormError } from "@/components/forms/FormError";
import { useForm } from "@/components/forms/useForm";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { editChallan } from "@/server/actions/challans";

/** Goods, places and trip only; amounts are fixed once booked (cancel and rebook to change). */
export function ChallanEditForm({
  t,
  trips,
  places,
  initial,
}: {
  t: Pick<Strings, "common" | "challans">;
  trips: { id: number; label: string }[];
  places: string[];
  initial: Record<string, string>;
}) {
  const { state, formAction, v, e } = useForm(editChallan, initial);
  const c = t.common;
  return (
    <form action={formAction} className="grid max-w-xl gap-5">
      <FormError state={state} c={c} />
      <input type="hidden" name="id" value={initial.id} />
      <datalist id="places">
        {places.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <Field id="tripId" label={t.challans.trip} c={c} optional>
        <SelectInput id="tripId" name="tripId" defaultValue={v("tripId")}>
          <option value="">{t.challans.noTrip}</option>
          {trips.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.label}
            </option>
          ))}
        </SelectInput>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="fromPlace" label={t.challans.from} error={e("fromPlace")} c={c}>
          <TextInput
            id="fromPlace"
            name="fromPlace"
            list="places"
            defaultValue={v("fromPlace")}
            invalid={Boolean(e("fromPlace"))}
          />
        </Field>
        <Field id="toPlace" label={t.challans.to} error={e("toPlace")} c={c}>
          <TextInput
            id="toPlace"
            name="toPlace"
            list="places"
            defaultValue={v("toPlace")}
            invalid={Boolean(e("toPlace"))}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="packages" label={t.challans.packages} error={e("packages")} c={c}>
          <TextInput
            id="packages"
            name="packages"
            inputMode="numeric"
            defaultValue={v("packages")}
            invalid={Boolean(e("packages"))}
          />
        </Field>
        <Field id="weightKg" label={t.challans.weight} error={e("weightKg")} c={c}>
          <TextInput
            id="weightKg"
            name="weightKg"
            inputMode="numeric"
            defaultValue={v("weightKg")}
            invalid={Boolean(e("weightKg"))}
          />
        </Field>
      </div>
      <Field id="description" label={t.challans.description} c={c} optional>
        <TextInput id="description" name="description" defaultValue={v("description")} />
      </Field>
      <SubmitButton label={c.save} pendingLabel={c.saving} className="w-full sm:w-auto" />
    </form>
  );
}
