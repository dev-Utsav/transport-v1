/**
 * Where the viewer is in the tour, kept in this browser only (a per-viewer convenience):
 * survives page loads and server-action redirects. Every access is guarded: private windows
 * and blocked storage just mean no saved tour.
 */
export type TourState = { step: number; pending: number | null; paused: boolean };

const KEY = "td_tour";
const EVENT = "td-tour-change";
let cachedRaw: string | null = null;
let cached: TourState | null = null;

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function getTour(): TourState | null {
  const raw = read();
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    cached =
      value && typeof value === "object" && "step" in value && typeof value.step === "number"
        ? {
            step: value.step,
            pending: "pending" in value && typeof value.pending === "number" ? value.pending : null,
            paused: "paused" in value && value.paused === true,
          }
        : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function setTour(state: TourState | null): void {
  try {
    if (state) window.localStorage.setItem(KEY, JSON.stringify(state));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the tour still runs for this page, it just won't survive a reload.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeTour(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export const getServerTour = (): TourState | null => null;
