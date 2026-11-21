import { defineConfig } from "@playwright/test";

/**
 * End-to-end, local only. Runs a production build (`next build && next start`) on :3300 against
 * its own throwaway database in .data/e2e (wiped and re-seeded with the sample data every run),
 * so it never touches the dev data in .data/pglite or a live DATABASE_URL.
 * Uses the installed Google Chrome (no browser download). Phone 390 px + desktop 1440 px.
 */
const PORT = 3300;
export const E2E_PASSWORD = "e2e-password";

export default defineConfig({
  testDir: "tests/end-to-end",
  outputDir: ".data/e2e-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: ".data/e2e-report", open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "phone",
      dependencies: ["setup"],
      use: {
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        storageState: ".data/e2e-results/session.json",
      },
    },
    {
      name: "desktop",
      dependencies: ["setup"],
      use: {
        viewport: { width: 1440, height: 900 },
        storageState: ".data/e2e-results/session.json",
      },
    },
  ],
  webServer: {
    command: `rm -rf .data/e2e && pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      TD_DATA_DIR: ".data/e2e",
      SEED_DEMO: "1",
      APP_PASSWORD: E2E_PASSWORD,
      CRON_SECRET: "e2e-cron-secret-0000",
      DATABASE_URL: "",
    },
  },
});
