import { formatMoney } from "@/lib/money";

/** An amount with tabular figures. `tone` colours money owed / received, always next to a word. */
export function Money({
  paise,
  tone,
  className = "",
}: {
  paise: number;
  tone?: "in" | "due" | undefined;
  className?: string;
}) {
  const color = tone === "in" ? "text-in" : tone === "due" ? "text-due" : "";
  return (
    <span className={`num whitespace-nowrap ${color} ${className}`}>{formatMoney(paise)}</span>
  );
}
