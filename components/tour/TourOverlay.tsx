"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { setTour } from "@/components/tour/tourStore";
import type { TourState } from "@/components/tour/tourStore";
import type { Strings } from "@/content/strings";
import { fill } from "@/content/strings";
import { afterClick, resolvePending, stepAt, TOUR_STEPS } from "@/lib/tour";
import type { TourStep } from "@/lib/tour";
import { leavePractice } from "@/server/actions/practice";

type T = Strings["tour"];

/**
 * The running tour. On the step's screen it dims everything except the highlighted element and
 * waits for the person to do the step; elsewhere it offers a way back.
 */
export function TourOverlay({ t, state, pathname }: { t: T; state: TourState; pathname: string }) {
  const router = useRouter();
  const step = stepAt(state.step);

  // A step waiting for its screen becomes current as soon as that screen opens.
  useEffect(() => {
    const next = resolvePending(state, pathname);
    if (next !== state) setTour({ ...state, ...next });
  }, [state, pathname]);

  if (!step) return null;
  if (step.path.test(pathname))
    return <StepView key={state.step} t={t} index={state.step} step={step} />;
  if (state.pending !== null && stepAt(state.pending)?.path.test(pathname)) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="tour-lost"
      className="fixed inset-x-3 bottom-24 z-[80] mx-auto grid max-w-md gap-3 rounded-card bg-road p-5 text-road-text shadow-lift lg:bottom-6"
    >
      <p id="tour-lost" className="text-[16px] font-semibold">
        {t.lost}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => router.push(step.home)}
          className="min-h-12 rounded-field bg-road-signal px-5 font-semibold text-road"
        >
          {t.goThere}
        </button>
        <button
          type="button"
          onClick={() => setTour(null)}
          className="min-h-12 px-3 font-semibold text-road-muted"
        >
          {t.end}
        </button>
      </div>
    </div>
  );
}

const PAD = 6;
const GIVE_UP_MS = 3000;

function isVisible(el: Element): boolean {
  return el.getClientRects().length > 0;
}

function StepView({ t, index, step }: { t: T; index: number; step: TourStep }) {
  const copy = t.steps[step.id];
  const total = TOUR_STEPS.length;
  const dims = useRef<(HTMLDivElement | null)[]>([]);
  const ring = useRef<HTMLDivElement>(null);
  const guard = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [found, setFound] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    let target: Element | null = null;
    let frame = 0;
    let detach = () => {};
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const attach = (el: Element) => {
      if (step.wait === "click") {
        const onClick = () => {
          const next = afterClick(index, window.location.pathname);
          setTour({ ...next, paused: false });
        };
        el.addEventListener("click", onClick, true);
        return () => el.removeEventListener("click", onClick, true);
      }
      if (step.wait === "change") {
        const onChange = () => setTour({ step: index + 1, pending: null, paused: false });
        el.addEventListener("change", onChange);
        return () => el.removeEventListener("change", onChange);
      }
      if (
        step.wait === "fill" &&
        (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
      ) {
        const onInput = () => setFilled(el.value.trim() !== "");
        onInput();
        el.addEventListener("input", onInput);
        return () => el.removeEventListener("input", onInput);
      }
      return () => {};
    };

    // One read-then-write pass per frame: find the target, then place the cut-out and bubble.
    const layout = () => {
      frame = 0;
      const el = step.target
        ? (Array.from(document.querySelectorAll(step.target)).find(isVisible) ?? null)
        : null;
      if (el !== target) {
        detach();
        target = el;
        detach = el ? attach(el) : () => {};
        setFound(Boolean(el));
        if (el) {
          el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
          if (step.wait === "next") heading.current?.focus({ preventScroll: true });
          else if (el instanceof HTMLElement) el.focus({ preventScroll: true });
        }
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const r = target?.getBoundingClientRect();
      const box = r
        ? { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 }
        : { x: vw / 2, y: vh / 2, w: 0, h: 0 };
      const rects = r
        ? [
            { l: 0, t: 0, w: vw, h: Math.max(0, box.y) },
            { l: 0, t: box.y + box.h, w: vw, h: Math.max(0, vh - box.y - box.h) },
            { l: 0, t: box.y, w: Math.max(0, box.x), h: box.h },
            { l: box.x + box.w, t: box.y, w: Math.max(0, vw - box.x - box.w), h: box.h },
          ]
        : [{ l: 0, t: 0, w: vw, h: vh }, null, null, null];
      rects.forEach((rect, i) => {
        const d = dims.current[i];
        if (!d) return;
        d.style.display = rect ? "block" : "none";
        if (!rect) return;
        d.style.left = `${rect.l}px`;
        d.style.top = `${rect.t}px`;
        d.style.width = `${rect.w}px`;
        d.style.height = `${rect.h}px`;
      });
      for (const el of [ring.current, guard.current]) {
        if (!el) continue;
        el.style.display = r ? "block" : "none";
        el.style.transform = `translate(${box.x}px, ${box.y}px)`;
        el.style.width = `${box.w}px`;
        el.style.height = `${box.h}px`;
      }
      placeBubble(bubble.current, r ? box : null, vw, vh);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(layout);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "open", "data-step"],
    });
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    const giveUp = window.setTimeout(() => {
      if (!target && step.target) setGaveUp(true);
    }, GIVE_UP_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTour({ step: index, pending: null, paused: true });
    };
    window.addEventListener("keydown", onKey);
    return () => {
      detach();
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(giveUp);
    };
  }, [index, step]);

  const isDone = step.id === "done";
  const needsAction = step.wait !== "next" && found && !gaveUp;
  const canNext = step.wait === "next" || (step.wait === "fill" && filled) || gaveUp;
  const goNext = () => setTour({ step: index + 1, pending: null, paused: false });

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          ref={(el) => {
            dims.current[i] = el;
          }}
          className="pointer-events-auto fixed bg-ink/55"
          style={{ display: "none" }}
        />
      ))}
      <div
        ref={ring}
        aria-hidden
        className="fixed top-0 left-0 rounded-[14px] ring-4 ring-road-signal"
        style={{ display: "none" }}
      />
      {/* On "read" steps the highlighted thing is shown, not used. */}
      <div
        ref={guard}
        aria-hidden
        className={`fixed top-0 left-0 ${step.wait === "next" ? "pointer-events-auto" : ""}`}
        style={{ display: "none" }}
      />

      <div
        ref={bubble}
        role="dialog"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="pointer-events-auto fixed grid gap-3 rounded-card bg-card p-5 text-ink shadow-lift ring-1 ring-rule"
        style={{ visibility: "hidden" }}
      >
        <p className="num text-[13px] font-semibold text-ink-2">
          {fill(t.progress, { n: index + 1, total })}
        </p>
        <h2
          id="tour-title"
          ref={heading}
          tabIndex={-1}
          className="text-[19px] leading-snug font-bold tracking-tight focus:outline-none"
        >
          {copy.title}
        </h2>
        <p id="tour-body" aria-live="polite" className="text-[16px] text-ink">
          {copy.body}
        </p>
        {needsAction && step.wait !== "fill" ? (
          <p className="flex items-center gap-2 text-[14px] font-semibold text-signal-ink">
            <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-signal" />
            {t.doIt}
          </p>
        ) : null}

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
            {index > 0 ? (
              <button
                type="button"
                onClick={() => setTour({ step: index - 1, pending: null, paused: false })}
                className="min-h-11 rounded-field px-3 font-semibold text-ink-2 ring-1 ring-rule-strong"
              >
                {t.back}
              </button>
            ) : null}
            {canNext ? (
              <button
                type="button"
                onClick={goNext}
                className="min-h-11 rounded-field bg-signal px-5 font-semibold text-card"
              >
                {gaveUp && step.wait !== "next" ? t.skipStep : t.next}
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
      </div>
    </div>
  );
}

/**
 * Phones: a sheet docked at the bottom (or the top when the target is low on the screen).
 * Wider screens: next to the target, below it when there is room, else above.
 */
function placeBubble(
  el: HTMLDivElement | null,
  box: { x: number; y: number; w: number; h: number } | null,
  vw: number,
  vh: number,
): void {
  if (!el) return;
  const s = el.style;
  s.visibility = "visible";
  if (vw < 640) {
    s.left = "12px";
    s.right = "12px";
    s.width = "auto";
    const targetIsLow = box ? box.y + box.h / 2 > vh * 0.5 : false;
    s.top = targetIsLow ? "calc(12px + env(safe-area-inset-top))" : "auto";
    s.bottom = targetIsLow ? "auto" : "calc(12px + env(safe-area-inset-bottom))";
    return;
  }
  const width = 380;
  const height = el.offsetHeight;
  s.width = `${width}px`;
  s.right = "auto";
  s.bottom = "auto";
  if (!box) {
    s.left = `${(vw - width) / 2}px`;
    s.top = `${Math.max(16, (vh - height) / 2)}px`;
    return;
  }
  const below = box.y + box.h + 12;
  const above = box.y - height - 12;
  const top =
    below + height < vh - 16 ? below : above > 16 ? above : Math.max(16, vh - height - 16);
  s.top = `${top}px`;
  s.left = `${Math.min(Math.max(16, box.x), vw - width - 16)}px`;
}
