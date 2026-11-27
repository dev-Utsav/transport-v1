"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TourBubble } from "@/components/tour/TourBubble";
import { readPage, tapTookEffect } from "@/components/tour/tourDom";
import { setTour } from "@/components/tour/tourStore";
import type { TourState } from "@/components/tour/tourStore";
import type { Strings } from "@/content/strings";
import { isOnStepScreen, resolvePending, stepAt, syncToPage } from "@/lib/tour";

type T = Strings["tour"];

/** The form switched panel (refused save, its own Back): follow it after this long. */
const PANEL_DRIFT_MS = 400;
/** A target that doesn't show: give the screen this long (navigation, refresh) before acting. */
const MISSING_MS = 2500;

/**
 * The running tour. The screen decides and the tour follows: a tap's step moves on once its
 * result shows; if the screen and the step drift apart, the tour moves to the step that matches
 * the screen; if nothing on this screen matches, it offers to go to the step's screen.
 */
export function TourOverlay({ t, state, pathname }: { t: T; state: TourState; pathname: string }) {
  const router = useRouter();
  const step = stepAt(state.step);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    let frame = 0;
    let driftSince = 0;
    const check = () => {
      frame = 0;
      const page = readPage();
      const now = performance.now();
      // 1. A tap's result is on screen: move on.
      if (state.pending !== null) {
        const next = resolvePending(state, page);
        const until = stepAt(state.step);
        if (
          next !== state &&
          tapTookEffect(state.step, until && "until" in until ? until.until : undefined)
        ) {
          setTour({ ...next, paused: false });
          return;
        }
        // On the way to, or already on, the next step's screen: give it time to show.
        if (!isOnStepScreen(state.step, page.pathname)) {
          driftSince ||= now;
          if (now - driftSince < MISSING_MS) return schedule(MISSING_MS);
          // On the next step's screen, but it doesn't show: hand over to it (it will follow the
          // screen from there). Somewhere unexpected: offer the way back.
          if (isOnStepScreen(state.pending, page.pathname)) {
            setTour({ step: state.pending, pending: null, paused: false });
          } else setLost(true);
          return;
        }
      }
      // 2. Screen and step agree: nothing to do.
      const match = syncToPage(state.step, page);
      if (match === state.step) {
        driftSince = 0;
        setLost(false);
        return;
      }
      driftSince ||= now;
      const panelMoved =
        match !== null && page.form !== undefined && stepAt(match)?.path.test(page.pathname);
      const wait = panelMoved ? PANEL_DRIFT_MS : MISSING_MS;
      if (now - driftSince < wait) {
        schedule(wait);
        return;
      }
      // 3. Follow the screen, or (nothing matches here) offer to go to the step's screen.
      if (match !== null) setTour({ step: match, pending: null, paused: false });
      else setLost(true);
    };
    let timer = 0;
    const schedule = (later = 0) => {
      if (later) {
        window.clearTimeout(timer);
        timer = window.setTimeout(schedule, later);
        return;
      }
      if (!frame) frame = requestAnimationFrame(check);
    };
    schedule();
    const observer = new MutationObserver(() => schedule());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-step", "aria-invalid", "hidden", "class"],
    });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [state, pathname]);

  if (!step) return null;
  const onScreen = step.path.test(pathname);
  if (onScreen && !lost) {
    return (
      <TourBubble
        key={state.step}
        t={t}
        index={state.step}
        step={step}
        waiting={state.pending !== null}
        pathname={pathname}
      />
    );
  }
  // On the way to the next screen after a tap: stay out of the way.
  if (state.pending !== null && !lost) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="tour-lost"
      className="fixed inset-x-3 bottom-24 z-[80] mx-auto grid max-w-md gap-3 rounded-card bg-road p-5 text-road-text shadow-lift lg:bottom-6"
    >
      <p id="tour-lost" className="text-[16px] font-semibold">
        {onScreen ? t.stuck : t.lost}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setLost(false);
            if (pathname === step.home) window.location.reload();
            else router.push(step.home);
          }}
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
