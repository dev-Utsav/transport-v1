import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Two local projects (no CI):
 * - unit: pure functions in lib/, no database, no Next.
 * - integrated: server actions + queries against a fresh in-memory Postgres (PGlite) per test,
 *   with Next's request APIs mocked (tests/fixtures/next-mocks.ts). Never touches .data/.
 * End-to-end runs in Playwright (playwright.config.ts), not here.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": root("./"),
      // `server-only` throws outside a React Server bundle; tests import server code directly.
      "server-only": root("./tests/fixtures/server-only.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integrated",
          include: ["tests/integrated/**/*.test.ts"],
          setupFiles: ["tests/fixtures/next-mocks.ts"],
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
