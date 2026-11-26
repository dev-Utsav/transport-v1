/**
 * Setup for the integrated project: loads tests/.env.test and replaces the Next request APIs
 * server actions use (cookies, headers, revalidatePath, redirect) with plain test doubles.
 */
import { existsSync } from "node:fs";

import { beforeEach, vi } from "vitest";

import { cookieJar } from "@/tests/fixtures/signals";

if (existsSync("tests/.env.test")) process.loadEnvFile("tests/.env.test");
// Actions check the session only when a password is set; tests opt in per case.
delete process.env.APP_PASSWORD;
delete process.env.DATABASE_URL;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1", host: "localhost" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

vi.mock("next/navigation", async () => {
  const { NotFoundSignal, RedirectSignal } = await import("@/tests/fixtures/signals");
  return {
    RedirectType: { push: "push", replace: "replace" },
    redirect: (url: string) => {
      throw new RedirectSignal(url);
    },
    notFound: () => {
      throw new NotFoundSignal();
    },
    unstable_rethrow: (err: unknown) => {
      if (err instanceof RedirectSignal || err instanceof NotFoundSignal) throw err;
    },
  };
});

beforeEach(() => {
  cookieJar.clear();
});
