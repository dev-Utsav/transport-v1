"use client";

import { useRef, useState, useSyncExternalStore } from "react";

import { FormError } from "@/components/forms/FormError";
import { PartyPicker } from "@/components/forms/PartyPicker";
import { useForm } from "@/components/forms/useForm";
import { Button } from "@/components/ui/Button";
import { Choice } from "@/components/ui/Choice";
import { Field, MoneyInput, SelectInput, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { formatDay } from "@/lib/dates";
import { splitGst, parseRate } from "@/lib/gst";
import { formatMoney, parseRupees } from "@/lib/money";
import { GST_MODES, PAY_MODES, PAY_TYPES } from "@/lib/types";
import type { GstMode } from "@/lib/types";
import { createChallan } from "@/server/actions/challans";

const noopSubscribe = () => () => {};

export type ChallanFormT = Pick<
  Strings,
  "common" | "challans" | "payTypes" | "payTypeHelp" | "modes" | "gstModes" | "trips"
>;

type Summary = { label: string; value: string }[];

/**
 * New challan in four short steps (parties → goods → freight → check). One <form>: steps only
 * hide panels, so the whole thing still posts (and shows as one long form) without JS.
 */
export function ChallanForm({
  t,
  parties,
  trips,
  places,
  initial,
}: {
  t: ChallanFormT;
  parties: { id: number; name: string }[];
  trips: { id: number; label: string; toPlace: string }[];
  places: string[];
  initial: Record<string, string>;
}) {
  const { state, formAction, v, e, hasErrors } = useForm(createChallan, initial);
  const c = t.common;
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState<Summary>([]);
  // A refused save reopens the step with the first problem (adjusting state on new props).
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.step !== undefined) setStep(state.step);
  }

  // Steps only switch on once hydrated; server HTML (and no-JS) shows the full form.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const steps = [
    t.challans.stepParties,
    t.challans.stepGoods,
    t.challans.stepMoney,
    t.challans.stepCheck,
  ];

  function panelIsValid(index: number): boolean {
    const panel = formRef.current?.querySelector(`[data-step-panel="${index}"]`);
    if (!panel) return true;
    for (const el of panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "input, select",
    )) {
      if (el.offsetParent !== null && !el.checkValidity()) {
        el.reportValidity();
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!panelIsValid(step)) return;
    if (step === 2) setSummary(buildSummary());
    setStep(step + 1);
    window.scrollTo({ top: 0 });
  }

  function buildSummary(): Summary {
    const form = formRef.current;
    if (!form) return [];
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "");
    const party = (name: string) =>
      text(name) === "new"
        ? text(`${name.replace("Id", "")}NewName`)
        : (parties.find((p) => String(p.id) === text(name))?.name ?? "");
    const freight = parseRupees(text("freight")) ?? 0;
    const gstMode: GstMode = GST_MODES.find((g) => g === text("gstMode")) ?? "none";
    const gst = splitGst(
      freight,
      gstMode,
      gstMode === "none" ? 0 : (parseRate(text("gstRate")) ?? 0),
    );
    const payType = PAY_TYPES.find((p) => p === text("payType"));
    const trip = trips.find((tr) => String(tr.id) === text("tripId"));
    return [
      { label: t.challans.sender, value: party("senderId") },
      { label: t.challans.receiver, value: party("receiverId") },
      { label: t.challans.trip, value: trip?.label ?? t.challans.noTrip },
      {
        label: `${t.challans.from} → ${t.challans.to}`,
        value: `${text("fromPlace")} → ${text("toPlace")}`,
      },
      {
        label: t.challans.packages,
        value: `${text("packages")}${text("description") ? ` · ${text("description")}` : ""}`,
      },
      { label: c.date, value: text("bookedOn") ? formatDay(text("bookedOn")) : "" },
      { label: t.challans.payType, value: payType ? t.payTypes[payType] : "" },
      ...(gst.gstAmount > 0
        ? [
            { label: t.challans.taxable, value: formatMoney(gst.taxable) },
            { label: t.challans.gstAmount, value: formatMoney(gst.gstAmount) },
          ]
        : []),
      { label: t.challans.total, value: formatMoney(gst.total) },
    ];
  }

  function onTripChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const trip = trips.find((tr) => String(tr.id) === event.target.value);
    const to = formRef.current?.elements.namedItem("toPlace");
    if (trip && to instanceof HTMLInputElement && !to.value) to.value = trip.toPlace;
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      data-steps
      data-step={hydrated ? step : undefined}
      className="grid max-w-xl gap-6"
    >
      <ol className="grid grid-cols-4 gap-1.5" aria-label={t.challans.new} hidden={!hydrated}>
        {steps.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i >= step}
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className="grid w-full gap-1.5 text-left disabled:cursor-default"
            >
              <span
                className={`h-1.5 rounded-full transition-colors duration-200 ${i <= step ? "bg-signal" : "bg-rule-strong"}`}
              />
              <span
                className={`truncate text-[13px] font-semibold ${i === step ? "text-ink" : "text-ink-2"}`}
              >
                {label}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <FormError show={hasErrors} message={c.fixErrors} />

      <datalist id="places">
        {places.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <fieldset data-step-panel="0" className="grid gap-5">
        <legend className="sr-only">{t.challans.stepParties}</legend>
        <PartyPicker
          name="senderId"
          label={t.challans.sender}
          parties={parties}
          v={v}
          e={e}
          c={c}
          newLabel={c.newParty}
        />
        <PartyPicker
          name="receiverId"
          label={t.challans.receiver}
          parties={parties}
          v={v}
          e={e}
          c={c}
          newLabel={c.newParty}
        />
        <Field id="tripId" label={t.challans.trip} c={c} optional>
          <SelectInput id="tripId" name="tripId" defaultValue={v("tripId")} onChange={onTripChange}>
            <option value="">{t.challans.noTrip}</option>
            {trips.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.label}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="bookedOn" label={c.date} error={e("bookedOn")} c={c}>
          <TextInput
            id="bookedOn"
            name="bookedOn"
            type="date"
            required
            defaultValue={v("bookedOn")}
            invalid={Boolean(e("bookedOn"))}
          />
        </Field>
      </fieldset>

      <fieldset data-step-panel="1" className="grid gap-5">
        <legend className="sr-only">{t.challans.stepGoods}</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field id="fromPlace" label={t.challans.from} error={e("fromPlace")} c={c}>
            <TextInput
              id="fromPlace"
              name="fromPlace"
              list="places"
              required
              autoComplete="off"
              defaultValue={v("fromPlace")}
              invalid={Boolean(e("fromPlace"))}
            />
          </Field>
          <Field id="toPlace" label={t.challans.to} error={e("toPlace")} c={c}>
            <TextInput
              id="toPlace"
              name="toPlace"
              list="places"
              required
              autoComplete="off"
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
              pattern="[0-9]*"
              required
              defaultValue={v("packages")}
              invalid={Boolean(e("packages"))}
            />
          </Field>
          <Field id="weightKg" label={t.challans.weight} error={e("weightKg")} c={c} optional>
            <TextInput
              id="weightKg"
              name="weightKg"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={v("weightKg")}
              invalid={Boolean(e("weightKg"))}
            />
          </Field>
        </div>
        <Field id="description" label={t.challans.description} c={c} optional>
          <TextInput id="description" name="description" defaultValue={v("description")} />
        </Field>
      </fieldset>

      <fieldset data-step-panel="2" className="grid gap-5">
        <legend className="sr-only">{t.challans.stepMoney}</legend>
        <Field id="freight" label={t.challans.freight} error={e("freight")} c={c}>
          <MoneyInput
            id="freight"
            name="freight"
            required
            defaultValue={v("freight")}
            invalid={Boolean(e("freight"))}
            className="text-[22px] font-semibold"
          />
        </Field>
        <Choice
          name="payType"
          tour="pay-type"
          legend={t.challans.payType}
          defaultValue={PAY_TYPES.find((p) => p === v("payType"))}
          options={PAY_TYPES.map((p) => ({
            value: p,
            label: t.payTypes[p],
            help: t.payTypeHelp[p],
          }))}
          error={e("payType") ? c.required : undefined}
        />
        <div data-when-paid>
          <Choice
            name="payNowMode"
            legend={t.challans.payNowMode}
            defaultValue={PAY_MODES.find((m) => m === v("payNowMode"))}
            options={PAY_MODES.map((m) => ({ value: m, label: t.modes[m] }))}
            error={e("payNowMode") ? c.required : undefined}
          />
        </div>
        <Choice
          name="gstMode"
          legend={t.challans.gst}
          defaultValue={GST_MODES.find((g) => g === v("gstMode"))}
          options={GST_MODES.map((g) => ({ value: g, label: t.gstModes[g] }))}
        />
        <div data-when-gst>
          <Field id="gstRate" label={t.challans.gstRate} error={e("gstRate")} c={c}>
            <TextInput
              id="gstRate"
              name="gstRate"
              inputMode="decimal"
              defaultValue={v("gstRate")}
              invalid={Boolean(e("gstRate"))}
              className="max-w-32"
            />
          </Field>
        </div>
      </fieldset>

      <section data-step-panel="3" className="grid gap-4" aria-label={t.challans.stepCheck}>
        <dl className="divide-y divide-rule rounded-card bg-card shadow-card ring-1 ring-rule">
          {summary.map((row) => (
            <div
              key={row.label}
              className="flex justify-between gap-4 px-4 py-3 last:text-[18px] last:font-bold"
            >
              <dt className="text-ink-2">{row.label}</dt>
              <dd className="num text-right">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="sticky bottom-24 z-10 flex gap-3 lg:bottom-4">
        {step > 0 ? (
          <Button
            variant="secondary"
            onClick={() => setStep(step - 1)}
            className="flex-1 sm:flex-none"
          >
            {c.back}
          </Button>
        ) : null}
        {hydrated && step < 3 ? (
          <Button onClick={goNext} className="flex-1 shadow-lift" data-tour="step-next">
            {c.next}
          </Button>
        ) : (
          <SubmitButton
            label={c.save}
            pendingLabel={c.saving}
            className="flex-1 shadow-lift"
            tour="save"
          />
        )}
      </div>
    </form>
  );
}
