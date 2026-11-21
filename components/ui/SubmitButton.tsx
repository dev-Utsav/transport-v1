"use client";

import { useFormStatus } from "react-dom";

import { buttonClass } from "@/components/ui/Button";

/** Shows the pending label while the form's server action runs, and blocks double saves. */
export function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
  className = "",
  name,
  value,
  tour,
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  name?: string;
  value?: string;
  tour?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      data-tour={tour}
      className={buttonClass(variant, className)}
      {...(name ? { name, value } : {})}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
