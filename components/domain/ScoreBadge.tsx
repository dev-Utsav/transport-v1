import { Pill } from "@/components/ui/Pill";
import type { Tone } from "@/components/ui/Pill";
import type { Strings } from "@/content/strings";
import type { ScoreBand } from "@/lib/score";

const TONE: Record<ScoreBand, Tone> = { good: "in", watch: "part", poor: "due" };

/** "82 · Good": the number and a word, never colour alone. */
export function ScoreBadge({
  score,
  band,
  bands,
}: {
  score: number;
  band: ScoreBand;
  bands: Strings["reports"]["bands"];
}) {
  return (
    <Pill tone={TONE[band]}>
      <span className="num">{score}</span>
      <span aria-hidden className="mx-1">
        ·
      </span>
      {bands[band]}
    </Pill>
  );
}
