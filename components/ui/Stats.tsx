import type { ReactNode } from "react";

/** A row of figures with their labels. One line on desktop, two columns on phones. */
export function Stats({
  items,
}: {
  items: readonly { label: string; value: ReactNode; tone?: "due" | "in" }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-rule shadow-card ring-1 ring-rule sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="grid gap-0.5 bg-card px-4 py-3.5">
          <dt className="text-[13px] font-semibold text-ink-2">{item.label}</dt>
          <dd
            className={`num text-[21px] leading-tight font-bold ${item.tone === "due" ? "text-due" : item.tone === "in" ? "text-in" : "text-ink"}`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
