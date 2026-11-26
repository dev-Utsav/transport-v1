import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sources(full);
    return /\.tsx?$/.test(e.name) ? [full] : [];
  });
}

/** Desk pages are dynamic: plain next/link would prefetch every link in view and flood the DB pool. */
describe("links prefetch on intent only", () => {
  it("nothing under app/ or components/ imports next/link except IntentLink and LinkPending (useLinkStatus)", () => {
    const offenders = [...sources("app"), ...sources("components")]
      .filter((f) => !["IntentLink.tsx", "LinkPending.tsx"].includes(path.basename(f)))
      .filter((f) => /from\s+["']next\/link["']/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

/**
 * A loading.tsx under the desk wraps every page in Suspense, so Next streams: the 200 status is sent
 * before the page runs (requireAccess -> notFound() then answers 200, not 404) and with JavaScript
 * off the streamed page stays hidden, which breaks the no-JS forms. Click feedback is LinkPending.
 */
describe("desk pages are not streamed", () => {
  it("no loading.tsx / loading.js under app/(desk)", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/^loading\.(tsx?|jsx?)$/.test(e.name)) offenders.push(full);
      }
    };
    if (existsSync("app/(desk)")) walk("app/(desk)");
    expect(offenders).toEqual([]);
  });
});
