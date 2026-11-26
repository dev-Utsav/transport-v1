/**
 * Where this tab has been inside the desk (sessionStorage, per tab), so "← Back" can return to
 * the screen the person came from instead of a fixed list. Forms aren't recorded: a save
 * replaces the form in browser history (redirect type "replace"), so history and trail agree.
 */
export type TrailEntry = { path: string; title: string };

const KEY = "td_trail";
const MAX = 30;
const FORM = /\/(new|edit|password)$/;

export function isFormPath(pathname: string): boolean {
  return FORM.test(pathname);
}

export function readTrail(): TrailEntry[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function isEntry(value: unknown): value is TrailEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    "title" in value &&
    typeof value.path === "string" &&
    typeof value.title === "string"
  );
}

/** Records the screen just shown: a step back pops, a reload updates, anything else pushes. */
export function recordVisit(entry: TrailEntry): void {
  if (isFormPath(pathOf(entry.path))) return;
  const trail = readTrail();
  const here = pathOf(entry.path);
  if (trail.length >= 2 && pathOf(trail[trail.length - 2]?.path ?? "") === here) trail.pop();
  if (pathOf(trail[trail.length - 1]?.path ?? "") === here) trail[trail.length - 1] = entry;
  else trail.push(entry);
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-MAX)));
  } catch {
    // Private mode or storage full: Back falls back to its fixed link.
  }
}

/** The screen before this one in this tab, if any. */
export function previousScreen(currentPath: string): TrailEntry | null {
  const trail = readTrail();
  for (let i = trail.length - 1; i >= 0; i--) {
    const entry = trail[i];
    if (entry && pathOf(entry.path) !== currentPath) return entry;
  }
  return null;
}

function pathOf(url: string): string {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}
