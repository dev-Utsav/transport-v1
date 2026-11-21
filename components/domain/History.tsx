import type { Strings } from "@/content/strings";

const when = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/** Which fields changed in an update, by name. */
function changedFields(before: unknown, after: unknown): string[] {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return [];
  const a = new Map(Object.entries(before));
  return Object.entries(after)
    .filter(
      ([key, value]) => key !== "createdAt" && JSON.stringify(a.get(key)) !== JSON.stringify(value),
    )
    .map(([key]) => key);
}

/** Collapsed change log: who-did-what isn't needed (one admin), but when and which fields is. */
export function History({
  t,
  rows,
}: {
  t: Strings;
  rows: { id: number; action: string; at: Date; before: unknown; after: unknown }[];
}) {
  if (rows.length === 0) return null;
  return (
    <details className="rounded-card bg-card px-4 py-3 ring-1 ring-rule sm:px-5" data-no-print>
      <summary className="cursor-pointer text-[15px] font-semibold text-ink-2">
        {t.common.changes} · {rows.length}
      </summary>
      <ol className="mt-3 grid gap-2 text-[14px]">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap gap-x-2">
            <span className="num text-ink-2">{when.format(r.at)}</span>
            <span className="font-semibold">{r.action}</span>
            <span className="text-ink-2">{changedFields(r.before, r.after).join(", ")}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
