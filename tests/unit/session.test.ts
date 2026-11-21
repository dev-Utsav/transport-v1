import { describe, expect, it } from "vitest";

import { signSession, verifySession } from "@/lib/session";

describe("session", () => {
  it("accepts its own token and rejects tampering", async () => {
    const token = await signSession("pw", 1_000);
    expect(await verifySession("pw", token, 2_000)).toBe(true);
    expect(await verifySession("other", token, 2_000)).toBe(false);
    expect(await verifySession("pw", token.replace(/.$/, "x"), 2_000)).toBe(false);
    expect(await verifySession("pw", undefined)).toBe(false);
  });
  it("expires after 30 days", async () => {
    const token = await signSession("pw", 0);
    expect(await verifySession("pw", token, 31 * 24 * 60 * 60 * 1000)).toBe(false);
  });
});
