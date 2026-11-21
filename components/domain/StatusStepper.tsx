/**
 * Status as a row of steps; tapping a step posts the change (one form per step, no JS needed).
 * Past steps are filled, the current one is marked, later ones are plain.
 */
export function StatusStepper<S extends string>({
  id,
  statuses,
  current,
  labels,
  legend,
  action,
  dark,
}: {
  id: number;
  statuses: readonly S[];
  current: S;
  labels: Record<S, string>;
  legend: string;
  action: (formData: FormData) => Promise<void>;
  dark?: boolean;
}) {
  const at = statuses.indexOf(current);
  return (
    <form action={action} aria-label={legend} data-no-print>
      <input type="hidden" name="id" value={id} />
      <div
        className={`grid gap-1.5 rounded-field p-1.5 ${dark ? "bg-road-2" : "bg-paper-deep"}`}
        style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(0, 1fr))` }}
      >
        {statuses.map((s, i) => {
          const isCurrent = i === at;
          const isPast = i < at;
          const tone = isCurrent
            ? "bg-signal text-card shadow-card"
            : isPast
              ? dark
                ? "text-road-text"
                : "text-ink"
              : dark
                ? "text-road-muted hover:bg-road"
                : "text-ink-2 hover:bg-card";
          return (
            <button
              key={s}
              name="status"
              value={s}
              aria-pressed={isCurrent}
              className={`flex min-h-11 items-center justify-center gap-1 rounded-[9px] px-1 text-[14px] font-semibold transition-colors duration-150 ${tone}`}
            >
              {isPast ? <span aria-hidden>✓</span> : null}
              {labels[s]}
            </button>
          );
        })}
      </div>
    </form>
  );
}
