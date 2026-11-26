"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormError } from "@/components/forms/FormError";
import { useForm } from "@/components/forms/useForm";
import { Choice } from "@/components/ui/Choice";
import { Field, MoneyInput, SelectInput, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { formatMoney, paiseToInput } from "@/lib/money";
import { PAY_MODES } from "@/lib/types";
import { recordPayment } from "@/server/actions/money";

type OpenChallan = { id: number; label: string; due: number };

/**
 * Record money received. Picking a party loads the page with that party's open challans
 * (plain GET, so it works without JS); picking a challan fills its due amount.
 */
export function PaymentForm({
  t,
  parties,
  openChallans,
  balance,
  initial,
}: {
  t: Pick<Strings, "common" | "payments" | "modes" | "vendors">;
  parties: { id: number; name: string }[];
  openChallans: OpenChallan[];
  balance: number | null;
  initial: Record<string, string>;
}) {
  const { state, formAction, v, e } = useForm(recordPayment, initial);
  const c = t.common;
  const router = useRouter();
  const [amount, setAmount] = useState(v("amount"));

  function onPartyChange(event: React.ChangeEvent<HTMLSelectElement>) {
    // Reload with the party so its open challans and balance come from the server; keep where
    // the payment was started from (trip, mode).
    const params = new URLSearchParams(window.location.search);
    params.set("vendor", event.target.value);
    params.delete("challan");
    router.push(`/payments/new?${params.toString()}`);
  }

  function onChallanChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const picked = openChallans.find((oc) => String(oc.id) === event.target.value);
    if (picked) setAmount(paiseToInput(picked.due));
  }

  return (
    <form action={formAction} className="grid max-w-xl gap-5">
      <FormError state={state} c={c} />
      {initial.back ? <input type="hidden" name="back" value={initial.back} /> : null}
      <Field id="vendorId" label={t.payments.party} error={e("vendorId")} c={c}>
        <SelectInput
          id="vendorId"
          name="vendorId"
          defaultValue={v("vendorId")}
          onChange={onPartyChange}
          invalid={Boolean(e("vendorId"))}
        >
          <option value="">{c.choose}</option>
          {parties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      {balance !== null ? (
        <p className="-mt-2 text-[15px] text-ink-2">
          {t.payments.balanceNow}:{" "}
          <span className={`num font-semibold ${balance > 0 ? "text-due" : "text-in"}`}>
            {formatMoney(balance)}
          </span>
        </p>
      ) : null}
      {openChallans.length ? (
        <Field id="challanId" label={t.payments.against} error={e("challanId")} c={c} optional>
          <SelectInput
            id="challanId"
            name="challanId"
            defaultValue={v("challanId")}
            onChange={onChallanChange}
            invalid={Boolean(e("challanId"))}
          >
            <option value="">{t.payments.againstNone}</option>
            {openChallans.map((oc) => (
              <option key={oc.id} value={oc.id}>
                {oc.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      ) : null}
      <Field id="amount" label={c.amount} error={e("amount")} c={c}>
        <MoneyInput
          id="amount"
          name="amount"
          value={amount}
          onChange={(ev) => setAmount(ev.target.value)}
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
      <Field id="paidOn" label={c.date} error={e("paidOn")} c={c}>
        <TextInput
          id="paidOn"
          name="paidOn"
          type="date"
          defaultValue={v("paidOn")}
          invalid={Boolean(e("paidOn"))}
        />
      </Field>
      <Field id="note" label={c.note} c={c} optional>
        <TextInput id="note" name="note" defaultValue={v("note")} />
      </Field>
      <SubmitButton label={c.save} pendingLabel={c.saving} className="w-full sm:w-auto" />
    </form>
  );
}
