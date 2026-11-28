import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { verifyPassword } from "@/lib/password";
import { changePassword, login } from "@/server/actions/session";
import { auditLog, users } from "@/server/db/schema";
import { setupTestDb } from "@/tests/fixtures/db";
import { TEST_PASSWORD, form, signInAs } from "@/tests/fixtures/factories";

const testDb = setupTestDb();

const change = (current: string, password: string, confirm = password) =>
  changePassword({ error: null }, form({ current, password, confirm }));

// Same shape as the live report (2026-11-28): the old password with one character added.
const NEXT_PASSWORD = `${TEST_PASSWORD}-Xy01`;

describe("change own password (Something went wrong on live, 2026-11-28)", () => {
  it("saves the new password, signs out other devices, keeps this one in, writes the audit", async () => {
    const { db } = testDb();
    const me = await signInAs(db, "admin");
    // Saved: back to Home, signed in with the new session (RedirectSignal from the Next mock).
    await expect(change(TEST_PASSWORD, NEXT_PASSWORD)).rejects.toThrow("redirect → /");
    const [after] = await db.select().from(users).where(eq(users.id, me.id));
    expect(after && (await verifyPassword(NEXT_PASSWORD, after.passwordHash))).toBe(true);
    expect(after?.sessionVersion).toBe(me.sessionVersion + 1);
    const audit = await db.select().from(auditLog).where(eq(auditLog.entity, "user"));
    expect(audit).toEqual([expect.objectContaining({ entityId: me.id, actorId: me.id })]);
  });

  it("refuses a wrong current password, a mismatch and the same password, changing nothing", async () => {
    const { db } = testDb();
    const me = await signInAs(db, "admin");
    expect(await change("not-my-password", NEXT_PASSWORD)).toEqual({ error: "wrong" });
    expect(await change(TEST_PASSWORD, NEXT_PASSWORD, `${NEXT_PASSWORD}x`)).toEqual({
      error: "mismatch",
    });
    expect(await change(TEST_PASSWORD, TEST_PASSWORD)).toEqual({ error: "password" });
    const [after] = await db.select().from(users).where(eq(users.id, me.id));
    expect(after?.sessionVersion).toBe(me.sessionVersion);
  });
});

// The error live threw for every transaction while max_pipeline was 0 (PR #4).
const liveError = () =>
  Object.assign(new Error("UNSAFE_TRANSACTION: Only use sql.begin, sql.reserved or max: 1"), {
    code: "UNSAFE_TRANSACTION",
  });

describe("sign-in forms never crash on a database failure (Something went wrong, 2026-11-28)", () => {
  it("change password: a plain message with a reference, the password unchanged", async () => {
    const { db } = testDb();
    const me = await signInAs(db, "admin");
    const spy = vi.spyOn(db, "transaction").mockRejectedValueOnce(liveError());
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await change(TEST_PASSWORD, NEXT_PASSWORD);
    expect(out).toEqual({
      error: null,
      failure: "server",
      ref: expect.stringMatching(/^[0-9a-f]{8}$/),
    });
    expect(JSON.stringify(out)).not.toContain("UNSAFE_TRANSACTION");
    expect(String(log.mock.calls[0]?.[0])).toContain(`ref=${out.ref}`);
    const [after] = await db.select().from(users).where(eq(users.id, me.id));
    expect(after && (await verifyPassword(TEST_PASSWORD, after.passwordHash))).toBe(true);
    spy.mockRestore();
    log.mockRestore();
  });

  it("sign in: a plain message with a reference", async () => {
    const { db } = testDb();
    const spy = vi.spyOn(db, "select").mockImplementationOnce(() => {
      throw liveError();
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await login({ error: null }, form({ login: "admin1", password: TEST_PASSWORD }));
    expect(out).toEqual({
      error: null,
      failure: "server",
      ref: expect.stringMatching(/^[0-9a-f]{8}$/),
    });
    spy.mockRestore();
    log.mockRestore();
  });
  // First admin setup: tests/integrated/users.test.ts (needs the setup key before env loads).
});
