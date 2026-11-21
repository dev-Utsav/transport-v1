import { describe, expect, it } from "vitest";

import { afterClick, isOnStepScreen, resolvePending, TOUR_STEPS } from "@/lib/tour";

const indexOf = (id: string) => TOUR_STEPS.findIndex((s) => s.id === id);

describe("tour", () => {
  it("has unique step ids and ends with done", () => {
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
    expect(TOUR_STEPS.at(-1)?.id).toBe("done");
  });
  it("moves on at once when the next step is on the same screen", () => {
    expect(afterClick(indexOf("next1"), "/challans/new")).toEqual({
      step: indexOf("to"),
      pending: null,
    });
  });
  it("waits for the next screen after a click that navigates", () => {
    const save = indexOf("save");
    const state = afterClick(save, "/challans/new");
    expect(state).toEqual({ step: save, pending: save + 1 });
    expect(resolvePending(state, "/challans/new")).toEqual(state);
    expect(resolvePending(state, "/challans/42")).toEqual({ step: save + 1, pending: null });
  });
  it("knows which screen a step lives on", () => {
    expect(isOnStepScreen(indexOf("trip"), "/trips/7")).toBe(true);
    expect(isOnStepScreen(indexOf("trip"), "/trips")).toBe(false);
  });
});
