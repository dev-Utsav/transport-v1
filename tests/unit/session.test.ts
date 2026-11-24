import { describe, expect, it } from "vitest";

import { sessionSecret, signSession, verifySession } from "@/lib/session";

const user = { userId: 7, version: 3 };

describe("session", () => {
  it("accepts its own token and returns who signed in", async () => {
    const token = await signSession("s", user, 1_000);
    expect(await verifySession("s", token, 2_000)).toEqual({ ...user, issuedAt: 1_000 });
  });
  it("rejects another secret, tampering, a swapped user id and junk", async () => {
    const token = await signSession("s", user, 1_000);
    expect(await verifySession("other", token, 2_000)).toBeNull();
    expect(await verifySession("s", token.replace(/.$/, "x"), 2_000)).toBeNull();
    expect(await verifySession("s", token.replace(/^7\./, "1."), 2_000)).toBeNull();
    expect(await verifySession("s", "1.1.1", 2_000)).toBeNull();
    expect(await verifySession("s", undefined)).toBeNull();
  });
  it("expires after 30 days", async () => {
    const token = await signSession("s", user, 0);
    expect(await verifySession("s", token, 31 * 24 * 60 * 60 * 1000)).toBeNull();
  });
  it("needs a real secret in production only", () => {
    expect(sessionSecret(undefined, "production")).toBeNull();
    expect(sessionSecret(undefined, "development")).toBeTruthy();
    expect(sessionSecret("abc", "production")).toBe("abc");
  });
});
