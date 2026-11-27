import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  accepts,
  afterClick,
  canGoBack,
  resolvePending,
  stepShows,
  syncToPage,
  TOUR_STEPS,
} from "@/lib/tour";
import type { TourPage } from "@/lib/tour";

const at = (id: string) => TOUR_STEPS.findIndex((s) => s.id === id);

/** A fake screen: which selectors show, which are invalid, which form panel is open. */
function page(
  pathname: string,
  opts: { form?: number; shows?: string[]; invalid?: string[] } = {},
): TourPage {
  return {
    pathname,
    form: opts.form,
    shows: (sel) => (opts.shows ?? []).includes(sel),
    invalid: (sel) => (opts.invalid ?? []).includes(sel),
  };
}

const NEXT = '[data-tour="step-next"]';
const SAVE = '[data-tour="save"]';
const PANEL0 = ["#senderId", "#receiverId", NEXT];
const PANEL2 = ["#freight", '[data-tour="pay-type"]', NEXT];

describe("tour steps (data)", () => {
  it("has unique ids and ends with done", () => {
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
    expect(TOUR_STEPS.at(-1)?.id).toBe("done");
  });

  it("every New challan step names its form panel, in order", () => {
    const onForm = TOUR_STEPS.filter((s) => s.path.test("/challans/new") && s.path.source !== ".*");
    const panels = onForm.map((s) => ("form" in s ? s.form : null));
    expect(panels).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2, 3]);
  });

  it("every target points at a hook that exists in the screens", () => {
    const src = sourceOf(["app", "components"]);
    for (const s of TOUR_STEPS) {
      if (!s.target) continue;
      for (const hook of s.target.match(/data-tour="([^"]+)"/g) ?? []) {
        const name = hook.slice('data-tour="'.length, -1);
        // The work board's buttons are named from a template: flow-${stage}-cta.
        const templated = /^flow-\w+-cta$/.test(name) && src.includes("flow-${stage}-cta");
        expect(src.includes(name) || templated, `${s.id}: ${name}`).toBe(true);
      }
      for (const id of s.target.match(/^#(\w+)$/)?.slice(1) ?? []) {
        expect(src.includes(id), `${s.id}: #${id}`).toBe(true);
      }
    }
  });
});

describe("only the answer the tour asks for counts (screenshots 1-3)", () => {
  it("Who pays: To-Pay moves on; Paid (which needs 'Received by') does not", () => {
    expect(accepts(at("payType"), ["to_pay"])).toBe(true);
    expect(accepts(at("payType"), ["paid"])).toBe(false);
    expect(accepts(at("payType"), ["billed"])).toBe(false);
  });

  it("parties: an existing one counts; empty and '+ New party' do not", () => {
    expect(accepts(at("sender"), ["12"])).toBe(true);
    expect(accepts(at("sender"), [""])).toBe(false);
    expect(accepts(at("sender"), ["new"])).toBe(false);
  });

  it("destination must be Delhi (the truck loading in the next steps goes there)", () => {
    expect(accepts(at("to"), [" delhi "])).toBe(true);
    expect(accepts(at("to"), ["Mumbai"])).toBe(false);
  });

  it("ticking parcels: any one ticked counts", () => {
    expect(accepts(at("tick"), [])).toBe(false);
    expect(accepts(at("tick"), ["41", "42"])).toBe(true);
  });
});

describe("a tap moves the tour only once the screen shows the result", () => {
  it("Next on the form: waits for the next panel, not the tap", () => {
    const state = afterClick(at("next1"));
    expect(state).toEqual({ step: at("next1"), pending: at("to") });
    // Panel 0 refused (a required field is empty): still waiting.
    expect(resolvePending(state, page("/challans/new", { form: 0, shows: PANEL0 }))).toEqual(state);
    const panel1 = page("/challans/new", { form: 1, shows: ["#toPlace", "#packages", NEXT] });
    expect(resolvePending(state, panel1)).toEqual({ step: at("to"), pending: null });
  });

  it("Save: waits for the challan's own page", () => {
    const state = afterClick(at("save"));
    expect(resolvePending(state, page("/challans/new", { form: 3, shows: [SAVE] }))).toEqual(state);
    const saved = page("/challans/42", { shows: ['[data-tour="next-step"]'] });
    expect(resolvePending(state, saved)).toEqual({ step: at("nextCard"), pending: null });
  });
});

describe("the tour follows the screen when they drift apart", () => {
  it("a refused save (form back on Freight) brings the tour to the marked field", () => {
    const refused = page("/challans/new", {
      form: 2,
      shows: PANEL2,
      invalid: ['[data-tour="pay-type"]'],
    });
    expect(syncToPage(at("save"), refused)).toBe(at("payType"));
  });

  it("a refused save on the first panel with nothing marked: that panel's first step", () => {
    expect(syncToPage(at("save"), page("/challans/new", { form: 0, shows: PANEL0 }))).toBe(
      at("sender"),
    );
  });

  it("the truck already left (Dispatch gone, Arrived showing): moves forward to Arrive", () => {
    const trip = page("/trips/3", {
      shows: ['[data-tour="trip-road"]', '[data-tour="next-action"][data-state="arrive"]'],
    });
    expect(syncToPage(at("dispatch"), trip)).toBe(at("arrive"));
  });

  it("never jumps to the menu steps that show on every screen", () => {
    const trip = page("/trips/3", { shows: ['[data-tour="nav-vendors"]', '[data-tour="lang"]'] });
    expect(syncToPage(at("deliver"), trip)).toBeNull();
  });

  it("on another screen it doesn't guess (the overlay offers 'Take me there')", () => {
    expect(syncToPage(at("receiver"), page("/", { shows: ['[data-tour="flow-book-cta"]'] }))).toBe(
      null,
    );
  });

  it("a step that shows stays put", () => {
    const here = page("/challans/new", { form: 0, shows: PANEL0 });
    expect(stepShows(at("receiver"), here)).toBe(true);
    expect(syncToPage(at("receiver"), here)).toBe(at("receiver"));
  });
});

describe("Back (back-click.png)", () => {
  it("works on the same screen, including across form panels", () => {
    expect(canGoBack(at("packages"), "/challans/new")).toBe(true);
    expect(canGoBack(at("to"), "/challans/new")).toBe(true); // back to "Tap Next" on panel 0
    expect(canGoBack(at("tick"), "/trips/3")).toBe(true);
  });

  it("never steps onto another screen", () => {
    expect(canGoBack(at("sender"), "/challans/new")).toBe(false); // "New challan" was on Home
  });

  it("never steps over something already saved", () => {
    for (const id of ["nextCard", "trip", "dispatch", "arrive", "deliver", "parties"]) {
      expect(canGoBack(at(id), "/trips/3"), id).toBe(false);
    }
  });
});

function sourceOf(dirs: string[]): string {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return files(full);
      return /\.tsx?$/.test(e.name) ? [full] : [];
    });
  return dirs
    .flatMap(files)
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
}
