import type { TourPage } from "@/lib/tour";

/**
 * The tour's eyes on the screen: what shows, which New challan panel is open, which fields are
 * marked, and what was tapped last (some steps wait for that button to go away).
 */
export function isVisible(el: Element): boolean {
  return el.getClientRects().length > 0;
}

export function findVisible(selector: string): Element | null {
  return Array.from(document.querySelectorAll(selector)).find(isVisible) ?? null;
}

export function readPage(): TourPage {
  const step = document.querySelector("form[data-steps]")?.getAttribute("data-step");
  const form = step === null || step === undefined || step === "" ? undefined : Number(step);
  return {
    pathname: window.location.pathname,
    form: Number.isInteger(form) ? form : undefined,
    shows: (selector) => findVisible(selector) !== null,
    invalid: (selector) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      // A field the server refused, or a radio group with its error line (Choice).
      return (
        el.matches('[aria-invalid="true"]') ||
        el.querySelector('[aria-invalid="true"]') !== null ||
        el.querySelector("[data-error]") !== null
      );
    },
  };
}

/** What the person has answered in a picker, field, radio group or checkbox list. */
export function answersOf(el: Element): string[] {
  if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) return [el.value];
  if (el instanceof HTMLTextAreaElement) return [el.value];
  return Array.from(el.querySelectorAll<HTMLInputElement>("input:checked")).map((i) => i.value);
}

/** The element tapped on a click step, kept across renders (module scope, this tab only). */
let lastTap: { step: number; el: Element } | null = null;

export function rememberTap(step: number, el: Element): void {
  lastTap = { step, el };
}

/**
 * For click steps with `until`: has the tap taken effect? `gone`: the tapped button left the
 * screen. `reset`: its form was reset after the save (no box still ticked). Unknown (e.g. after
 * a reload) counts as done, so the tour never waits forever.
 */
export function tapTookEffect(step: number, until: "gone" | "reset" | undefined): boolean {
  if (!until || !lastTap || lastTap.step !== step) return true;
  const el = lastTap.el;
  if (!el.isConnected || !isVisible(el)) return true;
  if (until === "gone") return false;
  const form = el instanceof HTMLButtonElement ? el.form : null;
  return form ? form.querySelector("input:checked") === null : true;
}

/** Ask the New challan form to open a panel (tour Back): ChallanForm listens for this. */
export const FORM_STEP_EVENT = "td-tour-form-step";

export function openFormPanel(panel: number): void {
  window.dispatchEvent(new CustomEvent(FORM_STEP_EVENT, { detail: panel }));
}

type Box = { x: number; y: number; w: number; h: number };

/**
 * Dims the whole screen except `box` (four panels around it, which also block taps outside),
 * and moves the ring and the tap guard onto it. No box: the whole screen is dimmed.
 */
export function paintSpotlight(
  dims: readonly (HTMLDivElement | null)[],
  onBox: readonly (HTMLDivElement | null)[],
  box: Box | null,
  vw: number,
  vh: number,
): void {
  const rects = box
    ? [
        { l: 0, t: 0, w: vw, h: Math.max(0, box.y) },
        { l: 0, t: box.y + box.h, w: vw, h: Math.max(0, vh - box.y - box.h) },
        { l: 0, t: box.y, w: Math.max(0, box.x), h: box.h },
        { l: box.x + box.w, t: box.y, w: Math.max(0, vw - box.x - box.w), h: box.h },
      ]
    : [{ l: 0, t: 0, w: vw, h: vh }, null, null, null];
  rects.forEach((rect, i) => {
    const d = dims[i];
    if (!d) return;
    d.style.display = rect ? "block" : "none";
    if (!rect) return;
    d.style.left = `${rect.l}px`;
    d.style.top = `${rect.t}px`;
    d.style.width = `${rect.w}px`;
    d.style.height = `${rect.h}px`;
  });
  for (const node of onBox) {
    if (!node) continue;
    node.style.display = box ? "block" : "none";
    if (!box) continue;
    node.style.transform = `translate(${box.x}px, ${box.y}px)`;
    node.style.width = `${box.w}px`;
    node.style.height = `${box.h}px`;
  }
}

/**
 * Phones: a sheet docked at the bottom (or the top when the target is low on the screen).
 * Wider screens: next to the target, below it when there is room, else above.
 */
export function placeBubble(
  el: HTMLDivElement | null,
  box: Box | null,
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
