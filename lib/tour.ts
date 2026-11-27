/**
 * The guided tour as data, and the rules that keep it in step with the screen.
 *
 * Each step names the screen it lives on, the element it points at, and what the person must do:
 *   next   → read, then tap Next
 *   click  → tap the highlighted thing; the tour moves on only once the screen shows the result
 *   change → pick something; only the answer the tour asks for counts (`value`, or any real pick)
 *   fill   → type into the highlighted field (`value` if the tour needs that exact text)
 *
 * The screen decides, the tour follows: a step counts as "here" only when its screen, its New
 * challan panel (`form`) and its target are all on show. If they drift apart (a refused save, the
 * form's own Back), the tour moves to the step that matches the screen. The path is fixed (To-Pay,
 * an existing party, Delhi) so no field outside the tour ever becomes required.
 * The tour only runs on the practice desk, so every real action is safe.
 */
export type TourWait = "next" | "click" | "change" | "fill";

type StepDef = {
  id: string;
  path: RegExp;
  target: string | null;
  wait: TourWait;
  /** Where "Take me there" goes. */
  home: string;
  /** New challan panel this step lives on (0 parties, 1 goods, 2 freight, 3 check). */
  form?: number;
  /** The one answer that counts (radio value, or text compared without case). */
  value?: string;
  /**
   * Click steps whose next step is already on show before the click lands: also wait until
   * the tapped button is gone (`gone`), or its form has been reset by the save (`reset`).
   */
  until?: "gone" | "reset";
  /** Something was saved just before this step: going Back can't undo it, so there's no Back. */
  checkpoint?: true;
};

const NEW = /^\/challans\/new$/;
const NEW_URL = "/challans/new";
const TRIP = /^\/trips\/\d+$/;

export const TOUR_STEPS = [
  { id: "welcome", path: /^\/$/, target: '[data-tour="flow-board"]', wait: "next", home: "/" },
  { id: "book", path: /^\/$/, target: '[data-tour="flow-book-cta"]', wait: "click", home: "/" },
  { id: "sender", path: NEW, target: "#senderId", wait: "change", home: NEW_URL, form: 0 },
  { id: "receiver", path: NEW, target: "#receiverId", wait: "change", home: NEW_URL, form: 0 },
  {
    id: "next1",
    path: NEW,
    target: '[data-tour="step-next"]',
    wait: "click",
    home: NEW_URL,
    form: 0,
  },
  { id: "to", path: NEW, target: "#toPlace", wait: "fill", home: NEW_URL, form: 1, value: "Delhi" },
  { id: "packages", path: NEW, target: "#packages", wait: "fill", home: NEW_URL, form: 1 },
  {
    id: "next2",
    path: NEW,
    target: '[data-tour="step-next"]',
    wait: "click",
    home: NEW_URL,
    form: 1,
  },
  { id: "freight", path: NEW, target: "#freight", wait: "fill", home: NEW_URL, form: 2 },
  {
    id: "payType",
    path: NEW,
    target: '[data-tour="pay-type"]',
    wait: "change",
    home: NEW_URL,
    form: 2,
    value: "to_pay",
  },
  {
    id: "next3",
    path: NEW,
    target: '[data-tour="step-next"]',
    wait: "click",
    home: NEW_URL,
    form: 2,
  },
  { id: "save", path: NEW, target: '[data-tour="save"]', wait: "click", home: NEW_URL, form: 3 },
  {
    id: "nextCard",
    path: /^\/challans\/\d+$/,
    target: '[data-tour="next-step"]',
    wait: "next",
    home: "/challans",
    checkpoint: true,
  },
  {
    id: "loadOn",
    path: /^\/challans\/\d+$/,
    target: '[data-tour="load-on-trip"]',
    wait: "click",
    home: "/challans",
  },
  {
    id: "trip",
    path: TRIP,
    target: '[data-tour="trip-road"]',
    wait: "next",
    home: "/trips",
    checkpoint: true,
  },
  { id: "tick", path: TRIP, target: '[data-tour="load-panel"]', wait: "change", home: "/trips" },
  {
    id: "loadSubmit",
    path: TRIP,
    target: '[data-tour="load-submit"]',
    wait: "click",
    home: "/trips",
    until: "reset",
  },
  {
    id: "dispatch",
    path: TRIP,
    target: '[data-tour="next-action"][data-state="dispatch"]',
    wait: "click",
    home: "/trips",
    checkpoint: true,
  },
  {
    id: "arrive",
    path: TRIP,
    target: '[data-tour="next-action"][data-state="arrive"]',
    wait: "click",
    home: "/trips",
    checkpoint: true,
  },
  {
    id: "deliver",
    path: TRIP,
    target: '[data-tour="deliver-first"]',
    wait: "click",
    home: "/trips",
    until: "gone",
    checkpoint: true,
  },
  {
    id: "parties",
    path: /.*/,
    target: '[data-tour="nav-vendors"]',
    wait: "click",
    home: "/",
    checkpoint: true,
  },
  {
    id: "partyRow",
    path: /^\/vendors$/,
    target: '[data-tour="party-row"]',
    wait: "click",
    home: "/vendors",
  },
  {
    id: "ledger",
    path: /^\/vendors\/\d+$/,
    target: '[data-tour="ledger"]',
    wait: "next",
    home: "/vendors",
  },
  {
    id: "pay",
    path: /^\/vendors\/\d+$/,
    target: '[data-tour="record-payment"]',
    wait: "next",
    home: "/vendors",
  },
  { id: "office", path: /.*/, target: '[data-tour="nav-office"]', wait: "next", home: "/" },
  { id: "lang", path: /.*/, target: '[data-tour="lang"]', wait: "next", home: "/" },
  { id: "done", path: /.*/, target: null, wait: "next", home: "/" },
] as const satisfies readonly StepDef[];

export type TourStep = (typeof TOUR_STEPS)[number];
export type TourStepId = TourStep["id"];

/** What the screen shows right now, read from the page (the overlay) or faked (tests). */
export type TourPage = {
  pathname: string;
  /** The New challan form's panel, when that form is on screen. */
  form: number | undefined;
  /** Is an element matching this selector on show? */
  shows: (selector: string) => boolean;
  /** Is the field matching this selector marked invalid? */
  invalid: (selector: string) => boolean;
};

export type TourPosition = { step: number; pending: number | null };

function def(index: number): StepDef | null {
  return TOUR_STEPS[index] ?? null;
}

export function stepAt(index: number): TourStep | null {
  return TOUR_STEPS[index] ?? null;
}

export function isOnStepScreen(index: number, pathname: string): boolean {
  return def(index)?.path.test(pathname) ?? false;
}

/** The step is "here": its screen, its form panel and its target are all on show. */
export function stepShows(index: number, page: TourPage): boolean {
  const s = def(index);
  if (!s || !s.path.test(page.pathname)) return false;
  if (s.form !== undefined && page.form !== s.form) return false;
  return s.target === null || page.shows(s.target);
}

/**
 * Does this answer count for a change / fill step? Empty and "+ New party" never do (the tour
 * keeps to existing parties so no extra fields appear); `value` must match when set.
 */
export function accepts(index: number, answers: readonly string[]): boolean {
  const s = def(index);
  const real = answers.map((a) => a.trim()).filter((a) => a !== "" && a !== "new");
  if (!s || real.length === 0) return false;
  const want = s.value?.toLowerCase();
  return want === undefined || real.some((a) => a.toLowerCase() === want);
}

/** Back stays on this screen and never steps over something already saved. */
export function canGoBack(index: number, pathname: string): boolean {
  const s = def(index);
  if (!s || index === 0 || s.checkpoint) return false;
  return isOnStepScreen(index - 1, pathname);
}

/** After a click: wait for the next step to show (the overlay checks `until` as well). */
export function afterClick(index: number): TourPosition {
  return { step: index, pending: index + 1 };
}

/** A pending step becomes current once it shows. */
export function resolvePending(state: TourPosition, page: TourPage): TourPosition {
  if (state.pending === null || !stepShows(state.pending, page)) return state;
  return { step: state.pending, pending: null };
}

/**
 * The step that matches the screen when the current one doesn't.
 * - On the New challan form, on a different panel (a refused save, the form's own Back): the
 *   panel's first step whose field is marked invalid, else the panel's first step.
 * - Otherwise the nearest step on this screen that shows: forward first (the screen moved on,
 *   e.g. the truck was already sent), then back.
 * Null when nothing on this screen matches (the overlay then offers to go to the step's screen).
 */
export function syncToPage(index: number, page: TourPage): number | null {
  if (stepShows(index, page)) return index;
  const s = def(index);
  // Not on this step's screen at all: the overlay offers "Take me there" instead.
  if (!s || !s.path.test(page.pathname)) return null;
  // Steps that live on every screen (menu, language) are never jumped to by accident.
  const same = TOUR_STEPS.map((_, i) => i).filter(
    (i) => isOnStepScreen(i, page.pathname) && def(i)?.path.source !== ".*",
  );
  if (s.form !== undefined && page.form !== undefined && s.path.test(page.pathname)) {
    const panel = same.filter((i) => def(i)?.form === page.form);
    const firstInvalid = panel.find((i) => {
      const target = def(i)?.target;
      return target ? page.invalid(target) : false;
    });
    return firstInvalid ?? panel[0] ?? null;
  }
  const forward = same.find((i) => i > index && stepShows(i, page));
  if (forward !== undefined) return forward;
  const back = same.filter((i) => i < index && stepShows(i, page)).at(-1);
  return back ?? null;
}
