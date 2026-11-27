import type { ComponentProps, ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import type { Strings } from "@/content/strings";

type FieldError = "required" | "invalid" | undefined;

const CONTROL =
  "block w-full min-h-12 rounded-field bg-card px-4 text-[17px] text-ink ring-1 ring-rule-strong transition-shadow duration-150 placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-signal aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-due";

/** Label above, control, then hint or error. The error is tied with aria-describedby. */
export function Field({
  id,
  label,
  hint,
  error,
  c,
  optional,
  children,
  className = "",
}: {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: FieldError;
  /** the common strings (required / invalid / optional) */
  c: Pick<Strings["common"], "required" | "invalid" | "optional">;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[15px] font-semibold text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-2"> · {c.optional}</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[14px] font-semibold text-due">
          {error === "required" ? c.required : c.invalid}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[14px] text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, error: FieldError, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

export function TextInput({
  invalid,
  className = "",
  ...rest
}: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input className={`${CONTROL} ${className}`} aria-invalid={invalid || undefined} {...rest} />
  );
}

/** Rupee amount: numeric keypad on phones, ₹ shown inside the field. */
export function MoneyInput({
  invalid,
  className = "",
  ...rest
}: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[17px] text-ink-2"
      >
        ₹
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        className={`${CONTROL} pl-9 ${className}`}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    </div>
  );
}

/** Native select (best picker on phones), with a drawn chevron instead of the browser's. */
export function SelectInput({
  invalid,
  className = "",
  children,
  ...rest
}: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <select
        // React resets a form after its action; a <select> then went back to the value it was
        // first rendered with, so a refused save lost the chosen party / truck (2026-11-27).
        // A new starting value (what was sent) mounts a fresh select that resets to it.
        key={String(rest.defaultValue ?? "")}
        className={`${CONTROL} appearance-none pr-11 ${className}`}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevronRight"
        size={18}
        className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 rotate-90 text-ink-2"
      />
    </div>
  );
}

export function TextArea({
  invalid,
  className = "",
  ...rest
}: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      rows={2}
      className={`${CONTROL} py-3 ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}
