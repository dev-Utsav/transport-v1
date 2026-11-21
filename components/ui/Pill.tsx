import type { CollectState } from "@/lib/types";

export type Tone = "in" | "due" | "part" | "signal" | "neutral" | "road";

const TONES: Record<Tone, string> = {
  in: "bg-in-soft text-in",
  due: "bg-due-soft text-due",
  part: "bg-part-soft text-part",
  signal: "bg-signal-soft text-signal-ink",
  neutral: "bg-paper-deep text-ink-2",
  road: "bg-road text-road-text",
};

/** Status always carries a word, never colour alone. */
export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export const COLLECT_TONE: Record<CollectState, Tone> = {
  settled: "in",
  part: "part",
  pending: "due",
  credit: "due",
};
