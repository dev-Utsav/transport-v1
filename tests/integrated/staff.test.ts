import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { EMPTY_FORM } from "@/lib/form";
import { saveDriver, saveEmployee } from "@/server/actions/masters";
import { staff } from "@/server/db/schema";
import { salaryRegister } from "@/server/queries/salary";
import { driverOptions } from "@/server/queries/trips";
import { setupTestDb } from "@/tests/fixtures/db";
import { expectRedirect, form, makeStaff } from "@/tests/fixtures/factories";

const testDb = setupTestDb();
const MONTH = "2026-11";

describe("one staff record per person", () => {
  it("a driver added in Settings is pickable on trips but not on the salary register", async () => {
    const { db } = testDb();
    await expectRedirect(() =>
      saveDriver(EMPTY_FORM, form({ name: "Imran", phone: "98", licence: "rj14" })),
    );
    const [row] = await db.select().from(staff);
    expect(row).toMatchObject({ role: "driver", onPayroll: false, licence: "RJ14" });
    expect((await driverOptions()).map((d) => d.name)).toEqual(["Imran"]);
    expect(await salaryRegister(MONTH)).toEqual([]);
  });

  it("putting that driver on salary updates the same record (no duplicate)", async () => {
    const { db } = testDb();
    const driver = await makeStaff(db, { name: "Ramesh" });
    await expectRedirect(() =>
      saveEmployee(
        EMPTY_FORM,
        form({
          id: driver.id,
          name: "Ramesh",
          role: "driver",
          monthlySalary: "22000",
          joinedOn: "2026-01-01",
        }),
      ),
    );
    const rows = await db.select().from(staff);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ onPayroll: true, monthlySalary: 2_200_000 });
    expect((await salaryRegister(MONTH)).map((r) => r.employee.name)).toEqual(["Ramesh"]);
    expect((await driverOptions()).map((d) => d.name)).toEqual(["Ramesh"]);
  });

  it("helpers and office staff are on salary but never offered as trip drivers", async () => {
    await expectRedirect(() =>
      saveEmployee(
        EMPTY_FORM,
        form({ name: "Kishan", role: "helper", monthlySalary: "12000", joinedOn: "2026-01-01" }),
      ),
    );
    expect(await driverOptions()).toEqual([]);
    expect((await salaryRegister(MONTH)).map((r) => r.employee.role)).toEqual(["helper"]);
  });

  it("the database refuses someone on payroll without a salary or joining date", async () => {
    const { db } = testDb();
    await expect(
      db.insert(staff).values({ name: "X", role: "office", onPayroll: true }),
    ).rejects.toThrow();
    const ok = await makeStaff(db, { role: "office" });
    await expect(
      db.update(staff).set({ onPayroll: true }).where(eq(staff.id, ok.id)),
    ).rejects.toThrow();
  });
});
