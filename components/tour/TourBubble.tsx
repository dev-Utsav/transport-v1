"use client";

import { useEffect, useRef, useState } from "react";

import {
  answersOf,
  findVisible,
  isVisible,
  openFormPanel,
  paintSpotlight,
  placeBubble,
  rememberTap,
} from "@/components/tour/tourDom";
import { TourControls } from "@/components/tour/TourControls";
import type { TourHint } from "@/components/tour/TourControls";
import { setTour } from "@/components/tour/tourStore";
import type { Strings } from "@/content/strings";
import { fill } from "@/content/strings";
import { accepts, afterClick, canGoBack, stepAt, TOUR_STEPS } from "@/lib/tour";
import type { TourStep } from "@/lib/tour";

type T = Strings["tour"];
const PAD = 6;

/**
 * One step on its screen: dims everything but the target, and moves on only when the step is
 * really done (the right answer picked, valid text typed, the tap's result on screen).
 */
export function TourBubble({
  t,
  index,
  step,
  waiting,
  pathname,
}: {
  t: T;
  index: number;
  step: TourStep;
  pathname: string;
  /** A tap was made; the tour waits for its result to show. */
  waiting: boolean;
}) {
  const copy = t.steps[step.id];
  const dims = useRef<(HTMLDivElement | null)[]>([]);
  const ring = useRef<HTMLDivElement>(null);
  const guard = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [done, setDone] = useState(false);
  const [hint, setHint] = useState<TourHint>(null);

  useEffect(() => {
    let target: Element | null = null;
    // A field the form refused on Next: lit instead of the target until it's filled, so the
    // person can reach it (the rest of the screen is dimmed and can't be tapped).
    let refused: Element | null = null;
    let frame = 0;
    let detach = () => {};
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const goNext = () => setTour({ step: index + 1, pending: null, paused: false });
    const answered = (el: Element) => {
      const ok = accepts(index, answersOf(el));
      const valid = !(el instanceof HTMLInputElement) || el.checkValidity();
      return ok && valid;
    };

    const attach = (el: Element) => {
      if (step.wait === "click") {
        const onClick = () => {
          rememberTap(index, el);
          setTour({ ...afterClick(index), paused: false });
        };
        el.addEventListener("click", onClick, true);
        return () => el.removeEventListener("click", onClick, true);
      }
      if (step.wait === "change" || step.wait === "fill") {
        // Already answered (coming Back, or after a reload): Next is offered straight away.
        setDone(answered(el));
        const onEdit = (event: Event) => {
          const ok = answered(el);
          setDone(ok);
          if (step.wait === "fill") return setHint(null);
          if (ok && event.type === "change") return goNext();
          setHint(answersOf(el).some((a) => a !== "") ? "wrongChoice" : null);
        };
        el.addEventListener("input", onEdit);
        el.addEventListener("change", onEdit);
        return () => {
          el.removeEventListener("input", onEdit);
          el.removeEventListener("change", onEdit);
        };
      }
      return () => {};
    };

    // One read-then-write pass per frame: find the target, then place the cut-out and bubble.
    const layout = () => {
      frame = 0;
      const el = step.target ? findVisible(step.target) : null;
      if (el !== target) {
        detach();
        target = el;
        detach = el ? attach(el) : () => {};
        if (el) {
          el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
          if (step.wait === "next") heading.current?.focus({ preventScroll: true });
          else if (el instanceof HTMLElement) el.focus({ preventScroll: true });
        }
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (refused && (!refused.isConnected || !isVisible(refused))) refused = null;
      const r = (refused ?? target)?.getBoundingClientRect();
      const box = r
        ? { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 }
        : null;
      paintSpotlight(dims.current, [ring.current, guard.current], box, vw, vh);
      placeBubble(bubble.current, box, vw, vh);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(layout);
    };

    // The form refused to move on (a required field is empty): say so instead of waiting.
    const onInvalid = (event: Event) => {
      setHint("fixFirst");
      // The tap didn't take: stop waiting for its result, the person fixes the field first.
      setTour({ step: index, pending: null, paused: false });
      if (refused || !(event.target instanceof Element)) return;
      // A hidden radio: light its whole group (Choice). Keep the first refused field.
      const el = event.target;
      refused =
        el instanceof HTMLInputElement && el.type === "radio" ? (el.closest("fieldset") ?? el) : el;
      refused.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      schedule();
    };
    const onAnyInput = (event: Event) => {
      if (!refused) return;
      const el = event.target;
      const fixed =
        el instanceof HTMLInputElement || el instanceof HTMLSelectElement
          ? el.checkValidity()
          : true;
      if (!fixed || !(el instanceof Node) || !(refused === el || refused.contains(el))) return;
      refused = null;
      setHint(null);
      schedule();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTour({ step: index, pending: null, paused: true });
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
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onAnyInput, true);
    window.addEventListener("keydown", onKey);
    return () => {
      detach();
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onAnyInput, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [index, step]);

  const isDone = step.id === "done";
  const shown: TourHint =
    hint ?? (waiting ? "waiting" : step.wait === "next" || done ? null : "doIt");
  const canNext =
    step.wait === "next" || ((step.wait === "change" || step.wait === "fill") && done);
  const back = () => {
    const prev = stepAt(index - 1);
    if (prev && "form" in prev) openFormPanel(prev.form);
    setTour({ step: index - 1, pending: null, paused: false });
  };

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
        data-tour-step={step.id}
        className="pointer-events-auto fixed grid gap-3 rounded-card bg-card p-5 text-ink shadow-lift ring-1 ring-rule"
        style={{ visibility: "hidden" }}
      >
        <p className="num text-[13px] font-semibold text-ink-2">
          {fill(t.progress, { n: index + 1, total: TOUR_STEPS.length })}
        </p>
        <h2
          id="tour-title"
          ref={heading}
          tabIndex={-1}
          className="text-[19px] leading-snug font-bold tracking-tight focus:outline-none"
        >
          {copy.title}
        </h2>
        <p id="tour-body" className="text-[16px] text-ink">
          {copy.body}
        </p>
        <TourControls
          t={t}
          hint={shown}
          isDone={isDone}
          onBack={canGoBack(index, pathname) ? back : null}
          onNext={canNext ? () => setTour({ step: index + 1, pending: null, paused: false }) : null}
        />
      </div>
    </div>
  );
}
