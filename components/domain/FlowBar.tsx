import type { Strings } from "@/content/strings";
import { fill } from "@/content/strings";
import { FLOW } from "@/lib/flow";
import type { FlowStage } from "@/lib/flow";

/**
 * "You are here" on the five-step flow, shown at the top of every record and form that
 * belongs to it. Done steps are ink, the current one is the signal colour, later ones are grey.
 */
export function FlowBar({ t, current }: { t: Strings; current: FlowStage }) {
  const at = FLOW.indexOf(current);
  return (
    <nav aria-label={fill(t.flow.stepOf, { n: at + 1 })} className="mb-5" data-no-print>
      <ol className="grid grid-cols-5 gap-1">
        {FLOW.map((stage, i) => {
          const state = i < at ? "done" : i === at ? "now" : "later";
          return (
            <li
              key={stage}
              aria-current={state === "now" ? "step" : undefined}
              className="grid gap-1.5"
            >
              <span
                className={`h-1.5 rounded-full ${state === "later" ? "bg-rule-strong" : state === "now" ? "bg-signal" : "bg-ink"}`}
              />
              <span
                className={`flex items-start gap-1 text-[12px] leading-tight font-semibold sm:text-[13px] ${state === "now" ? "text-signal-ink" : state === "done" ? "text-ink" : "text-ink-2"}`}
              >
                <span className="num">{i + 1}</span>
                <span>{t.flow.names[stage]}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
