import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Server actions redirect with "push" by default, which leaves the filled-in form in history:
 * the phone's Back button then reopens it and a second Save books a duplicate. Every action
 * redirect replaces the form instead.
 */
describe("action redirects", () => {
  it("replace the form in browser history", () => {
    const dir = "server/actions";
    const pushes = readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .flatMap((f) => {
        const src = readFileSync(path.join(dir, f), "utf8");
        // Each redirect( … ) call, up to its closing parenthesis on the same statement.
        return [...src.matchAll(/(?<![\w.])redirect\(([\s\S]*?)\);/g)]
          .filter((m) => !(m[1] ?? "").includes("RedirectType.replace"))
          .map((m) => `${f}: redirect(${(m[1] ?? "").trim()})`);
      });
    expect(pushes).toEqual([]);
  });
});
