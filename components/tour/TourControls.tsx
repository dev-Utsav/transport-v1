"use client";

import { setTour } from "@/components/tour/tourStore";
import type { Strings } from "@/content/strings";
import { leavePractice } from "@/server/actions/practice";

/** Why the tour can't move on yet, shown under the step's text. */
export type TourHint = "doIt" | "wrongChoice" | "fixFirst" | "waiting" | null;

/** The bubble's hint line and buttons. No `onBack` / `onNext`: that button isn't offered. */
export function TourControls({
  t,
  hint,
  isDone,
  onBack,
  onNext,
}: {
  t: Strings["tour"];
  hint: TourHint;
  isDone: boolean;
  onBack: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const warn = hint === "wrongChoice" || hint === "fixFirst";
  return (
    <>
      <p
        aria-live="polite"
        className={`flex items-center gap-2 text-[14px] font-semibold ${warn ? "text-due" : "text-signal-ink"}`}
      >
        {hint ? (
          <>
            <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-current" />
            {t[hint]}
          </>
        ) : null}
      </p>

      {isDone ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <form action={leavePractice} onSubmit={() => setTour(null)}>
            <button className="min-h-12 w-full rounded-field bg-signal px-4 font-semibold text-card">
              {t.finish}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setTour(null)}
            className="min-h-12 rounded-field px-4 font-semibold ring-1 ring-rule-strong"
          >
            {t.keep}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="min-h-11 rounded-field px-3 font-semibold text-ink-2 ring-1 ring-rule-strong"
            >
              {t.back}
            </button>
          ) : null}
          {onNext ? (
            <button
              type="button"
              onClick={onNext}
              className="min-h-11 rounded-field bg-signal px-5 font-semibold text-card"
            >
              {t.next}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setTour(null)}
            className="ml-auto min-h-11 px-2 text-[14px] font-semibold text-ink-2 underline underline-offset-2"
          >
            {t.end}
          </button>
        </div>
      )}
    </>
  );
}
