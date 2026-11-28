import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { EMPTY_FORM } from "@/lib/form";
import { verifyPassword } from "@/lib/password";
import { SESSION_COOKIE } from "@/lib/session";
import { login, setupFirstAdmin } from "@/server/actions/session";
import { resetUserPassword, saveUser, toggleUser } from "@/server/actions/users";
import { getActor } from "@/server/auth";
import { roles, userRoles, users } from "@/server/db/schema";
import { needsFirstAdmin } from "@/server/queries/users";
import { setupTestDb } from "@/tests/fixtures/db";
import {
  TEST_PASSWORD,
  expectRedirect,
  form,
  makeStaff,
  makeUser,
  run,
  signInAs,
} from "@/tests/fixtures/factories";
import { cookieJar } from "@/tests/fixtures/signals";

// server/env.ts reads the setup key once, at import.
vi.hoisted(() => {
  process.env.APP_PASSWORD = "setup-key-123";
});

const testDb = setupTestDb({ signedIn: false });

async function roleId(key: string): Promise<number> {
  const [r] = await testDb().db.select({ id: roles.id }).from(roles).where(eq(roles.key, key));
  if (!r) throw new Error(`no role ${key}`);
  return r.id;
}

describe("first run: the setup key creates the first admin, once", () => {
  const fields = {
    name: "Owner",
    login: "owner",
    password: "longpassword",
    confirm: "longpassword",
  };

  it("refuses a wrong key, then creates the admin and signs in", async () => {
    expect(await needsFirstAdmin()).toBe(true);
    const wrong = await setupFirstAdmin({ error: null }, form({ ...fields, key: "nope" }));
    expect(wrong.error).toBe("key");
    await expect(
      setupFirstAdmin({ error: null }, form({ ...fields, key: "setup-key-123" })),
    ).rejects.toThrow(/redirect/);
    expect(await needsFirstAdmin()).toBe(false);
    expect((await getActor())?.permissions.has("users.manage")).toBe(true);
  });

  it("is refused once any login exists", async () => {
    const { db } = testDb();
    await makeUser(db, "office");
    const again = await setupFirstAdmin({ error: null }, form({ ...fields, key: "setup-key-123" }));
    expect(again.error).toBe("done");
  });

  it("a database failure comes back as a message with a reference, no login created", async () => {
    const { db } = testDb();
    // The error live threw for every transaction while max_pipeline was 0 (PR #4, 2026-11-28).
    const unsafe = Object.assign(new Error("UNSAFE_TRANSACTION: Only use sql.begin"), {
      code: "UNSAFE_TRANSACTION",
    });
    const spy = vi.spyOn(db, "transaction").mockRejectedValueOnce(unsafe);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await setupFirstAdmin({ error: null }, form({ ...fields, key: "setup-key-123" }));
    expect(out).toEqual({
      error: null,
      failure: "server",
      ref: expect.stringMatching(/^[0-9a-f]{8}$/),
    });
    expect(await needsFirstAdmin()).toBe(true);
    spy.mockRestore();
    log.mockRestore();
  });
});

describe("signing in", () => {
  it("accepts the right password (login name in any case), refuses wrong or switched-off", async () => {
    const { db } = testDb();
    const user = await makeUser(db, "office", { login: "Neha" });
    expect(await login({ error: null }, form({ login: "neha", password: "wrong-one" }))).toEqual({
      error: "wrong",
    });
    await expect(
      login({ error: null }, form({ login: "NEHA", password: TEST_PASSWORD })),
    ).rejects.toThrow(/redirect/);
    expect(cookieJar.get(SESSION_COOKIE)).toBeTruthy();
    await db.update(users).set({ isActive: false }).where(eq(users.id, user.id));
    expect(await login({ error: null }, form({ login: "neha", password: TEST_PASSWORD }))).toEqual({
      error: "wrong",
    });
  });
});

describe("managing users (admin)", () => {
  it("a driver login must point at a driver in Staff", async () => {
    const { db } = testDb();
    await signInAs(db, "admin");
    const helper = await makeStaff(db, { role: "helper" });
    const driver = await makeStaff(db, { role: "driver" });
    const base = {
      name: "Ramesh",
      login: "ramesh",
      password: "first-pass-1",
      roleIds: await roleId("driver"),
    };
    const refused = await run(() => saveUser(EMPTY_FORM, form({ ...base, staffId: helper.id })));
    expect("state" in refused && refused.state?.errors.staffId).toBe("invalid");
    await expectRedirect(() => saveUser(EMPTY_FORM, form({ ...base, staffId: driver.id })));
    const [created] = await db.select().from(users).where(eq(users.login, "ramesh"));
    expect(created).toMatchObject({ staffId: driver.id, mustChangePassword: true });
  });

  it("refuses a taken login name (case-insensitive) and no roles", async () => {
    const { db } = testDb();
    await signInAs(db, "admin", { login: "Admin" });
    const officeRole = await roleId("office");
    const taken = await run(() =>
      saveUser(
        EMPTY_FORM,
        form({
          name: "X",
          login: "admin",
          password: "first-pass-1",
          roleIds: officeRole,
        }),
      ),
    );
    expect("state" in taken && taken.state?.errors.login).toBe("invalid");
    const noRole = await run(() =>
      saveUser(EMPTY_FORM, form({ name: "X", login: "x1", password: "first-pass-1" })),
    );
    expect("state" in noRole && noRole.state?.errors.roleIds).toBe("invalid");
  });

  it("never leaves the desk without an active admin, and nobody switches off themselves", async () => {
    const { db } = testDb();
    const me = await signInAs(db, "admin");
    const self = await toggleUser(EMPTY_FORM, form({ id: me.id }));
    expect(self.errors.self).toBe("invalid");
    const officeRole = await roleId("office");
    const demote = await run(() =>
      saveUser(
        EMPTY_FORM,
        form({ id: me.id, name: me.name, login: me.login, roleIds: officeRole }),
      ),
    );
    expect("state" in demote && demote.state?.errors["roleIds-lastAdmin"]).toBe("invalid");
    const held = await db.select().from(userRoles).where(eq(userRoles.userId, me.id));
    expect(held).toHaveLength(1);
  });

  it("a password reset signs that person out and makes them choose a new one", async () => {
    const { db } = testDb();
    const target = await makeUser(db, "office");
    await signInAs(db, "admin");
    await expectRedirect(() =>
      resetUserPassword(EMPTY_FORM, form({ id: target.id, password: "brand-new-9" })),
    );
    const [after] = await db.select().from(users).where(eq(users.id, target.id));
    expect(after?.sessionVersion).toBe(target.sessionVersion + 1);
    expect(after?.mustChangePassword).toBe(true);
    expect(await verifyPassword("brand-new-9", after?.passwordHash ?? "")).toBe(true);
  });

  it("only an admin may manage users", async () => {
    const { db } = testDb();
    await signInAs(db, "office");
    const out = await saveUser(EMPTY_FORM, form({ name: "X", login: "x2" }));
    expect(out.failure).toBe("denied");
    expect(out.values.login).toBe("x2");
  });
});
