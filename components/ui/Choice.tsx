/**
 * Big tap targets instead of a dropdown when there are 2–4 options (pay type, mode, status).
 * Plain radios underneath: works with keyboard, screen readers and without JS.
 */
export function Choice<V extends string>({
  name,
  legend,
  options,
  defaultValue,
  error,
  columns = 3,
  tour,
  required = false,
}: {
  name: string;
  legend: string;
  options: readonly { value: V; label: string; help?: string }[];
  defaultValue?: V | undefined;
  error?: string | undefined;
  columns?: 2 | 3 | 4;
  tour?: string;
  /** One must be picked (checked by the form's step Next too, while the group shows). */
  required?: boolean;
}) {
  const cols = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns];
  return (
    <fieldset className="grid gap-1.5" data-tour={tour}>
      <legend className="mb-1.5 text-[15px] font-semibold text-ink">{legend}</legend>
      <div className={`grid gap-2 ${cols}`}>
        {options.map((o) => (
          <label
            key={o.value}
            className="relative flex min-h-12 cursor-pointer flex-col justify-center rounded-field bg-card px-3 py-2.5 text-center ring-1 ring-rule-strong transition-colors duration-150 has-checked:bg-signal-soft has-checked:ring-2 has-checked:ring-signal has-focus-visible:outline-3 has-focus-visible:outline-signal"
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={o.value === defaultValue}
              required={required}
              className="sr-only"
            />
            <span className="text-[16px] font-semibold text-ink">{o.label}</span>
            {o.help ? (
              <span className="mt-0.5 text-[13px] leading-snug text-ink-2">{o.help}</span>
            ) : null}
          </label>
        ))}
      </div>
      {error ? (
        <p data-error className="text-[14px] font-semibold text-due">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
