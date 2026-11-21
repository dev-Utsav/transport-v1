"use client";

import { FormError } from "@/components/forms/FormError";
import { useForm } from "@/components/forms/useForm";
import { describedBy, Field, SelectInput, TextArea, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { saveTrip } from "@/server/actions/trips";

export function TripForm({
  t,
  trucks,
  drivers,
  places,
  initial,
}: {
  t: Pick<Strings, "common" | "trips">;
  trucks: { id: number; number: string; type: string }[];
  drivers: { id: number; name: string }[];
  places: string[];
  initial: Record<string, string>;
}) {
  const { formAction, v, e, hasErrors } = useForm(saveTrip, initial);
  const c = t.common;
  return (
    <form action={formAction} className="grid max-w-xl gap-5">
      <FormError show={hasErrors} message={c.fixErrors} />
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {initial.challanId ? (
        <input type="hidden" name="challanId" value={initial.challanId} />
      ) : null}
      <Field id="truckId" label={t.trips.truck} error={e("truckId")} c={c}>
        <SelectInput
          id="truckId"
          name="truckId"
          defaultValue={v("truckId")}
          invalid={Boolean(e("truckId"))}
          aria-describedby={describedBy("truckId", e("truckId"))}
        >
          <option value="">{c.choose}</option>
          {trucks.map((tk) => (
            <option key={tk.id} value={tk.id}>
              {tk.number}
              {tk.type ? ` · ${tk.type}` : ""}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field id="driverId" label={t.trips.driver} c={c} optional>
        <SelectInput id="driverId" name="driverId" defaultValue={v("driverId")}>
          <option value="">{c.none}</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      <datalist id="places">
        {places.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-3">
        <Field id="fromPlace" label={t.trips.from} error={e("fromPlace")} c={c}>
          <TextInput
            id="fromPlace"
            name="fromPlace"
            list="places"
            defaultValue={v("fromPlace")}
            invalid={Boolean(e("fromPlace"))}
            autoComplete="off"
          />
        </Field>
        <Field id="toPlace" label={t.trips.to} error={e("toPlace")} c={c}>
          <TextInput
            id="toPlace"
            name="toPlace"
            list="places"
            defaultValue={v("toPlace")}
            invalid={Boolean(e("toPlace"))}
            autoComplete="off"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="departOn" label={t.trips.departOn} error={e("departOn")} c={c}>
          <TextInput
            id="departOn"
            name="departOn"
            type="date"
            defaultValue={v("departOn")}
            invalid={Boolean(e("departOn"))}
          />
        </Field>
        <Field id="expectedOn" label={t.trips.expectedOn} error={e("expectedOn")} c={c} optional>
          <TextInput
            id="expectedOn"
            name="expectedOn"
            type="date"
            defaultValue={v("expectedOn")}
            invalid={Boolean(e("expectedOn"))}
          />
        </Field>
      </div>
      <Field id="note" label={c.note} c={c} optional>
        <TextArea id="note" name="note" defaultValue={v("note")} />
      </Field>
      <SubmitButton label={c.save} pendingLabel={c.saving} className="w-full sm:w-auto" />
    </form>
  );
}
