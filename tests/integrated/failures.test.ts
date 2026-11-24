import { describe, expect, it, vi } from "vitest";

import { GET as exportReport } from "@/app/api/export/[report]/route";
import { EMPTY_FORM } from "@/lib/form";
import { hashPassword } from "@/lib/password";
import { recordPayment } from "@/server/actions/money";
import { login } from "@/server/actions/session";
import { payments } from "@/server/db/schema";
import { setupTestDb } from "@/tests/fixtures/db";
import { form, makeParty, makeUser, signInAs } from "@/tests/fixtures/factories";

const testDb = setupTestDb();
const pay = (vendorId: number) =>
  form({ vendorId, amount: "250", mode: "cash", paidOn: "2026-11-21", note: "kept" });

describe("a save that fails never crashes the screen or shows the raw error", () => {
  it("returns the typed values, a plain failure and a reference; nothing is written", async () => {
    const { db } = testDb();
    const party = await makeParty(db);
    const raw = Object.assign(new Error('relation "payments" violates secret_internal_detail'), {
      code: "XX000",
    });
    const spy = vi.spyOn(db, "transaction").mockRejectedValueOnce(raw);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await recordPayment(EMPTY_FORM, pay(party.id));

    expect(out.ok).toBe(false);
    expect(out.failure).toBe("server");
    expect(out.ref).toMatch(/^[0-9a-f]{8}$/);
    expect(out.values).toMatchObject({ amount: "250", note: "kept" });
    expect(JSON.stringify(out)).not.toContain("secret_internal_detail");
    // the real error is in the server log, next to the same reference
    expect(String(log.mock.calls[0]?.[0])).toContain(`ref=${out.ref}`);
    expect(await db.select().from(payments)).toHaveLength(0);
    spy.mockRestore();
    log.mockRestore();
  });

  it("a role without permission gets 'denied' and keeps what they typed", async () => {
    const { db } = testDb();
    const party = await makeParty(db);
    await signInAs(db, "helper");
    const out = await recordPayment(EMPTY_FORM, pay(party.id));
    expect(out.failure).toBe("denied");
    expect(out.values.amount).toBe("250");
    expect(await db.select().from(payments)).toHaveLength(0);
  });
});

describe("security fixes", () => {
  const salaryCsv = () =>
    exportReport(new Request("http://localhost/api/export/salary?month=2026-11"), {
      params: Promise.resolve({ report: "salary" }),
    });

  it("office can export reports but not the salary register", async () => {
    const { db } = testDb();
    await signInAs(db, "office");
    expect((await salaryCsv()).status).toBe(403);
    await signInAs(db, "admin");
    expect((await salaryCsv()).status).toBe(200);
  });

  it("refuses an oversized password without hashing it, even if it would match", async () => {
    const { db } = testDb();
    const huge = "x".repeat(5000);
    await makeUser(db, "office", { login: "bigpass", passwordHash: await hashPassword(huge) });
    const out = await login({ error: null }, form({ login: "bigpass", password: huge }));
    expect(out.error).toBe("wrong");
  });
});
