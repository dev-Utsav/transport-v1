"use client";

import { FormError } from "@/components/forms/FormError";
import { useForm } from "@/components/forms/useForm";
import { Choice } from "@/components/ui/Choice";
import { describedBy, Field, MoneyInput, TextArea, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { GST_MODES } from "@/lib/types";
import { saveSettings } from "@/server/actions/settings";

export function SettingsForm({
  t,
  initial,
}: {
  t: Pick<Strings, "common" | "settings" | "gstModes">;
  initial: Record<string, string>;
}) {
  const { state, formAction, v, e } = useForm(saveSettings, initial);
  const c = t.common;
  const s = t.settings;
  const group = "grid gap-5 rounded-card bg-card p-5 shadow-card ring-1 ring-rule sm:p-6";
  return (
    <form action={formAction} className="grid gap-6">
      <FormError state={state} c={c} />
      <fieldset className={group}>
        <legend className="float-left mb-1 text-[18px] font-bold">{s.business}</legend>
        <Field id="businessName" label={s.businessName} c={c} className="clear-left">
          <TextInput id="businessName" name="businessName" defaultValue={v("businessName")} />
        </Field>
        <Field id="address" label={c.address} c={c} optional>
          <TextArea id="address" name="address" defaultValue={v("address")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="phone" label={c.phone} error={e("phone")} c={c} optional>
            <TextInput
              id="phone"
              name="phone"
              type="tel"
              defaultValue={v("phone")}
              invalid={Boolean(e("phone"))}
            />
          </Field>
          <Field id="gstin" label={s.gstin} error={e("gstin")} c={c} optional>
            <TextInput
              id="gstin"
              name="gstin"
              maxLength={15}
              className="uppercase"
              defaultValue={v("gstin")}
              invalid={Boolean(e("gstin"))}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className={group}>
        <legend className="float-left mb-1 text-[18px] font-bold">GST</legend>
        <div className="clear-left">
          <Choice
            name="gstMode"
            legend={s.gstDefault}
            defaultValue={GST_MODES.find((g) => g === v("gstMode"))}
            options={GST_MODES.map((g) => ({ value: g, label: t.gstModes[g] }))}
          />
        </div>
        <Field id="gstRate" label={s.gstRate} error={e("gstRate")} c={c}>
          <TextInput
            id="gstRate"
            name="gstRate"
            inputMode="decimal"
            className="max-w-32"
            defaultValue={v("gstRate")}
            invalid={Boolean(e("gstRate"))}
          />
        </Field>
      </fieldset>

      <fieldset className={group}>
        <legend className="float-left mb-1 text-[18px] font-bold">{s.numbering}</legend>
        <div className="clear-left grid gap-4 sm:grid-cols-2">
          <Field id="challanPrefix" label={s.prefix} error={e("challanPrefix")} c={c} optional>
            <TextInput
              id="challanPrefix"
              name="challanPrefix"
              maxLength={12}
              defaultValue={v("challanPrefix")}
              invalid={Boolean(e("challanPrefix"))}
            />
          </Field>
          <Field
            id="nextChallanNo"
            label={s.nextNo}
            hint={s.nextNoHelp}
            error={e("nextChallanNo")}
            c={c}
          >
            <TextInput
              id="nextChallanNo"
              name="nextChallanNo"
              inputMode="numeric"
              defaultValue={v("nextChallanNo")}
              invalid={Boolean(e("nextChallanNo"))}
              aria-describedby={describedBy("nextChallanNo", e("nextChallanNo"), s.nextNoHelp)}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="openingCash" label={s.openingCash} error={e("openingCash")} c={c}>
            <MoneyInput
              id="openingCash"
              name="openingCash"
              defaultValue={v("openingCash")}
              invalid={Boolean(e("openingCash"))}
            />
          </Field>
          <Field id="reminderDays" label={s.reminderDays} error={e("reminderDays")} c={c}>
            <TextInput
              id="reminderDays"
              name="reminderDays"
              inputMode="numeric"
              className="max-w-32"
              defaultValue={v("reminderDays")}
              invalid={Boolean(e("reminderDays"))}
            />
          </Field>
        </div>
      </fieldset>
      <SubmitButton
        label={c.save}
        pendingLabel={c.saving}
        className="w-full sm:w-auto sm:justify-self-start"
      />
    </form>
  );
}
