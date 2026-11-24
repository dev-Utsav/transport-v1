import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The proxy only checks that a cookie is signed; who may open what is checked on each page and
 * route. This keeps a new screen from shipping without that check.
 */
function files(dir: string, name: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return files(full, name);
    return e.name === name ? [full] : [];
  });
}

describe("access guards", () => {
  it("every signed-in page checks access", () => {
    const pages = files("app/(desk)", "page.tsx");
    expect(pages.length).toBeGreaterThan(30);
    const open = pages.filter((p) => !/requireAccess\(|getActor\(/.test(readFileSync(p, "utf8")));
    expect(open).toEqual([]);
  });

  it("every API route checks access (the cron route checks its own secret)", () => {
    const routes = files("app/api", "route.ts").filter(
      (p) => !p.includes(`${path.sep}cron${path.sep}`),
    );
    const open = routes.filter((p) => !readFileSync(p, "utf8").includes("apiDenied("));
    expect(open).toEqual([]);
  });

  it("every server action checks access (except signing in / out and the language)", () => {
    const PUBLIC = new Set(["login", "setupFirstAdmin", "logout", "setLang", "changePassword"]);
    let checked = 0;
    for (const file of readdirSync("server/actions")) {
      const src = readFileSync(path.join("server/actions", file), "utf8");
      const fns = [...src.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g)];
      for (const [, name, body] of fns) {
        if (!name || PUBLIC.has(name)) continue;
        expect(body, `${file} → ${name}`).toMatch(/assertCan\(/);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(25);
  });
});
