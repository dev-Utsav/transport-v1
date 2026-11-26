/**
 * A share of a whole as a bar (0–1), with its label beside it. Drawn with scaleX, so it can
 * animate without layout work; the number is always printed too.
 */
export function ShareBar({
  value,
  tone = "signal",
  label,
}: {
  value: number;
  tone?: "signal" | "in" | "due" | "part";
  label?: string;
}) {
  const fill = { signal: "bg-signal", in: "bg-in", due: "bg-due", part: "bg-part" }[tone];
  const share = Math.min(1, Math.max(0, value));
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="h-2 min-w-16 flex-1 overflow-hidden rounded-pill bg-paper-deep">
        <span
          className={`block h-full origin-left rounded-pill ${fill} transition-transform duration-500 ease-(--ease-out) starting:scale-x-0`}
          style={{ transform: `scaleX(${share})` }}
        />
      </span>
      {label ? <span className="num w-12 text-right text-[14px] text-ink-2">{label}</span> : null}
    </span>
  );
}
