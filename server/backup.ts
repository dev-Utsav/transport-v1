import "server-only";

import { gzipSync } from "node:zlib";

import { desc, inArray } from "drizzle-orm";

import { getDb } from "@/server/db";
import * as schema from "@/server/db/schema";

const KEEP = 30;

/** Every table except the backups themselves, as one JSON document (photos as base64). */
export async function exportAll(): Promise<string> {
  const db = await getDb();
  const [
    settings,
    trucks,
    staff,
    trips,
    vendors,
    challans,
    payments,
    expenses,
    billPhotos,
    salaryMonths,
    auditLog,
    users,
    roles,
    rolePermissions,
    userRoles,
  ] = await Promise.all([
    db.select().from(schema.settings),
    db.select().from(schema.trucks),
    db.select().from(schema.staff),
    db.select().from(schema.trips),
    db.select().from(schema.vendors),
    db.select().from(schema.challans),
    db.select().from(schema.payments),
    db.select().from(schema.expenses),
    db.select().from(schema.billPhotos),
    db.select().from(schema.salaryMonths),
    db.select().from(schema.auditLog),
    // Password hashes stay out of the backup file: after a restore the owner resets passwords.
    db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        login: schema.users.login,
        phone: schema.users.phone,
        staffId: schema.users.staffId,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users),
    db.select().from(schema.roles),
    db.select().from(schema.rolePermissions),
    db.select().from(schema.userRoles),
  ]);
  return JSON.stringify({
    app: "transport-desk",
    version: 1,
    takenAt: new Date().toISOString(),
    tables: {
      settings,
      trucks,
      staff,
      trips,
      vendors,
      challans,
      payments,
      expenses,
      billPhotos: billPhotos.map((p) => ({ ...p, data: Buffer.from(p.data).toString("base64") })),
      salaryMonths,
      auditLog,
      users,
      roles,
      rolePermissions,
      userRoles,
    },
  });
}

/** Nightly: store a gzip copy in the database and keep the latest 30. */
export async function takeBackup(): Promise<{ id: number; sizeBytes: number }> {
  const db = await getDb();
  const data = gzipSync(await exportAll());
  const [row] = await db
    .insert(schema.backups)
    .values({ sizeBytes: data.byteLength, data })
    .returning({ id: schema.backups.id });
  if (!row) throw new Error("Backup insert failed");
  const old = await db
    .select({ id: schema.backups.id })
    .from(schema.backups)
    .orderBy(desc(schema.backups.takenAt))
    .offset(KEEP);
  if (old.length)
    await db.delete(schema.backups).where(
      inArray(
        schema.backups.id,
        old.map((o) => o.id),
      ),
    );
  return { id: row.id, sizeBytes: data.byteLength };
}

export async function listBackups() {
  const db = await getDb();
  return db
    .select({
      id: schema.backups.id,
      takenAt: schema.backups.takenAt,
      sizeBytes: schema.backups.sizeBytes,
    })
    .from(schema.backups)
    .orderBy(desc(schema.backups.takenAt))
    .limit(KEEP);
}
