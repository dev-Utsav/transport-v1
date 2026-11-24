"use client";

import { FormError } from "@/components/forms/FormError";
import { useForm } from "@/components/forms/useForm";
import { Choice } from "@/components/ui/Choice";
import { describedBy, Field, MoneyInput, TextArea, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { VENDOR_KINDS } from "@/lib/types";
import { saveVendor } from "@/server/actions/vendors";

export function VendorForm({
  t,
  initial,
}: {
  t: Pick<Strings, "common" | "vendors" | "vendorKinds">;
  initial: Record<string, string>;
}) {
  const { state, formAction, v, e } = useForm(saveVendor, initial);
  const c = t.common;
  return (
    <form action={formAction} className="grid max-w-xl gap-5">
      <FormError state={state} c={c} />
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {initial.back ? <input type="hidden" name="back" value={initial.back} /> : null}
      <Field id="name" label={c.name} error={e("name")} c={c}>
        <TextInput
          id="name"
          name="name"
          defaultValue={v("name")}
          invalid={Boolean(e("name"))}
          autoComplete="off"
        />
      </Field>
      <Field id="phone" label={c.phone} error={e("phone")} c={c} optional>
        <TextInput
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={v("phone")}
          invalid={Boolean(e("phone"))}
        />
      </Field>
      <Choice
        name="kind"
        legend={t.vendors.kind}
        defaultValue={VENDOR_KINDS.find((k) => k === v("kind")) ?? "both"}
        options={VENDOR_KINDS.map((k) => ({ value: k, label: t.vendorKinds[k] }))}
      />
      <Field id="address" label={c.address} c={c} optional>
        <TextArea id="address" name="address" defaultValue={v("address")} />
      </Field>
      <Field id="gstin" label={t.vendors.gstin} error={e("gstin")} c={c} optional>
        <TextInput
          id="gstin"
          name="gstin"
          defaultValue={v("gstin")}
          invalid={Boolean(e("gstin"))}
          className="uppercase"
          maxLength={15}
        />
      </Field>
      <Field
        id="openingBalance"
        label={t.vendors.opening}
        hint={t.vendors.openingHelp}
        error={e("openingBalance")}
        c={c}
      >
        <MoneyInput
          id="openingBalance"
          name="openingBalance"
          defaultValue={v("openingBalance") || "0"}
          invalid={Boolean(e("openingBalance"))}
          aria-describedby={describedBy(
            "openingBalance",
            e("openingBalance"),
            t.vendors.openingHelp,
          )}
        />
      </Field>
      <SubmitButton label={c.save} pendingLabel={c.saving} className="w-full sm:w-auto" />
    </form>
  );
}
