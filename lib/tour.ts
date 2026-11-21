/**
 * The guided tour as data. Each step names the screen it lives on, the element it points at,
 * and what the person must do to move on:
 *   next   → read, then tap Next
 *   click  → tap the highlighted thing (often it opens the next screen)
 *   change → pick something in the highlighted picker / tick a box
 *   fill   → type into the highlighted field, then tap Next
 * The tour only runs on the practice desk, so every real action is safe.
 */
export type TourWait = "next" | "click" | "change" | "fill";

export const TOUR_STEPS = [
  { id: "welcome", path: /^\/$/, target: '[data-tour="flow-board"]', wait: "next", home: "/" },
  { id: "book", path: /^\/$/, target: '[data-tour="flow-book-cta"]', wait: "click", home: "/" },
  {
    id: "sender",
    path: /^\/challans\/new$/,
    target: "#senderId",
    wait: "change",
    home: "/challans/new",
  },
  {
    id: "receiver",
    path: /^\/challans\/new$/,
    target: "#receiverId",
    wait: "change",
    home: "/challans/new",
  },
  {
    id: "next1",
    path: /^\/challans\/new$/,
    target: '[data-tour="step-next"]',
    wait: "click",
    home: "/challans/new",
  },
  { id: "to", path: /^\/challans\/new$/, target: "#toPlace", wait: "fill", home: "/challans/new" },
  {
    id: "packages",
    path: /^\/challans\/new$/,
    target: "#packages",
    wait: "fill",
    home: "/challans/new",
  },
  {
    id: "next2",
    path: /^\/challans\/new$/,
    target: '[data-tour="step-next"]',
    wait: "click",
    home: "/challans/new",
  },
  {
    id: "freight",
    path: /^\/challans\/new$/,
    target: "#freight",
    wait: "fill",
    home: "/challans/new",
  },
  {
    id: "payType",
    path: /^\/challans\/new$/,
    target: '[data-tour="pay-type"]',
    wait: "change",
    home: "/challans/new",
  },
  {
    id: "next3",
    path: /^\/challans\/new$/,
    target: '[data-tour="step-next"]',
    wait: "click",
    home: "/challans/new",
  },
  {
    id: "save",
    path: /^\/challans\/new$/,
    target: '[data-tour="save"]',
    wait: "click",
    home: "/challans/new",
  },
  {
    id: "nextCard",
    path: /^\/challans\/\d+$/,
    target: '[data-tour="next-step"]',
    wait: "next",
    home: "/challans",
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
    path: /^\/trips\/\d+$/,
    target: '[data-tour="trip-road"]',
    wait: "next",
    home: "/trips",
  },
  {
    id: "tick",
    path: /^\/trips\/\d+$/,
    target: '[data-tour="load-panel"]',
    wait: "change",
    home: "/trips",
  },
  {
    id: "loadSubmit",
    path: /^\/trips\/\d+$/,
    target: '[data-tour="load-submit"]',
    wait: "click",
    home: "/trips",
  },
  {
    id: "dispatch",
    path: /^\/trips\/\d+$/,
    target: '[data-tour="next-action"][data-state="dispatch"]',
    wait: "click",
    home: "/trips",
  },
  {
    id: "arrive",
    path: /^\/trips\/\d+$/,
    target: '[data-tour="next-action"][data-state="arrive"]',
    wait: "click",
    home: "/trips",
  },
  {
    id: "deliver",
    path: /^\/trips\/\d+$/,
    target: '[data-tour="deliver-first"]',
    wait: "click",
    home: "/trips",
  },
  { id: "parties", path: /.*/, target: '[data-tour="nav-vendors"]', wait: "click", home: "/" },
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
] as const satisfies readonly {
  id: string;
  path: RegExp;
  target: string | null;
  wait: TourWait;
  home: string;
}[];

export type TourStep = (typeof TOUR_STEPS)[number];
export type TourStepId = TourStep["id"];

export function stepAt(index: number): TourStep | null {
  return TOUR_STEPS[index] ?? null;
}

export function isOnStepScreen(index: number, pathname: string): boolean {
  return stepAt(index)?.path.test(pathname) ?? false;
}

/**
 * After a "click" step: move on now if the next step is on this same screen; otherwise wait
 * until the screen it lives on opens (a refused save keeps the person on the current step).
 */
export function afterClick(
  index: number,
  pathname: string,
): { step: number; pending: number | null } {
  return isOnStepScreen(index + 1, pathname)
    ? { step: index + 1, pending: null }
    : { step: index, pending: index + 1 };
}

/** A pending step becomes current once its screen is open. */
export function resolvePending(
  state: { step: number; pending: number | null },
  pathname: string,
): { step: number; pending: number | null } {
  if (state.pending === null || !isOnStepScreen(state.pending, pathname)) return state;
  return { step: state.pending, pending: null };
}
