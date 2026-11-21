"use client";

import { buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/** Opens the browser's print dialog (which also gives "Save as PDF"). */
export function PrintButton({
  label,
  variant = "primary",
}: {
  label: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass(variant)}>
      <Icon name="print" size={20} />
      {label}
    </button>
  );
}
