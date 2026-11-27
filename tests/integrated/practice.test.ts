import { describe, expect, it, vi } from "vitest";

import { startPractice } from "@/server/actions/practice";
import { PRACTICE_COOKIE } from "@/server/practice-flag";
import { setupTestDb } from "@/tests/fixtures/db";
import { cookieJar, RedirectSignal } from "@/tests/fixtures/signals";

const testDb = setupTestDb();

function entry(from: string, tour = true): FormData {
  const f = new FormData();
  f.set("from", from);
  if (tour) f.set("tour", "1");
  return f;
}

async function redirectOf(run: Promise<unknown>): Promise<string> {
  const err = await run.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(err instanceof RedirectSignal)) throw new Error(`expected a redirect, got ${String(err)}`);
  return err.url;
}

describe("opening the practice desk (Settings → Take the tour answered 500 on live, 2026-11-27)", () => {
  it("opens on fresh sample data, with the tour", async () => {
    expect(await redirectOf(startPractice(entry("/settings")))).toBe("/?tour=start");
    expect(cookieJar.get(PRACTICE_COOKIE)).toBe("1");
  });

  it("if the practice database fails, goes back with a message, stays on the real desk", async () => {
    const { practice } = testDb();
    vi.spyOn(practice, "transaction").mockRejectedValueOnce(new Error("practice db down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await redirectOf(startPractice(entry("/settings")))).toBe("/settings?practice=failed");
    expect(cookieJar.has(PRACTICE_COOKIE)).toBe(false);
    expect(String(log.mock.calls[0]?.[0])).toContain("[practice]");
    log.mockRestore();
  });

  it("only comes back to a known screen", async () => {
    const { practice } = testDb();
    vi.spyOn(practice, "transaction").mockRejectedValueOnce(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await redirectOf(startPractice(entry("https://evil.example/")))).toBe(
      "/?practice=failed",
    );
  });
});
