import "server-only";

import { gzipSync } from "node:zlib";

import { desc, inArray } from "drizzle-orm";

import { getRealDb } from "@/server/db";
import * as schema from "@/server/db/schema";

const KEEP = 30;

/**
 * Every table except the backups themselves and the permission catalog (rebuilt from
 * lib/access.ts on start), as one JSON document (photos as base64). A new table must be added
 * here: tests/integrated/backup.test.ts fails otherwise.
 *
 * - Always the real desk, also when the admin is on the practice desk (CLAUDE.md §7b).
 * - One read-only repeatable-read transaction: every table as of the same moment (a payment
 *   saved mid-backup can't appear without its challan), on one connection, one query at a time.
 *   15 reads at once hung the transaction pooler past Vercel's 300 s (504, 2026-11-28).
 */
export async function exportAll(): Promise<string> {
  const db = await getRealDb();
  const tables = await db.transaction(
    async (tx) => ({
      settings: await tx.select().from(schema.settings),
      trucks: await tx.select().from(schema.trucks),
      staff: await tx.select().from(schema.staff),
      trips: await tx.select().from(schema.trips),
      vendors: await tx.select().from(schema.vendors),
      challans: await tx.select().from(schema.challans),
      payments: await tx.select().from(schema.payments),
      expenses: await tx.select().from(schema.expenses),
      billPhotos: await tx.select().from(schema.billPhotos),
      salaryMonths: await tx.select().from(schema.salaryMonths),
      staffAdvances: await tx.select().from(schema.staffAdvances),
      auditLog: await tx.select().from(schema.auditLog),
      // Password hashes stay out of the backup file: after a restore the owner resets passwords.
      users: await tx
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
      roles: await tx.select().from(schema.roles),
      rolePermissions: await tx.select().from(schema.rolePermissions),
      userRoles: await tx.select().from(schema.userRoles),
    }),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  return JSON.stringify({
    app: "transport-desk",
    version: 1,
    takenAt: new Date().toISOString(),
    tables: {
      ...tables,
      billPhotos: tables.billPhotos.map((p) => ({
        ...p,
        data: Buffer.from(p.data).toString("base64"),
      })),
    },
  });
}

/** Nightly: store a gzip copy in the database and keep the latest 30. */
export async function takeBackup(): Promise<{ id: number; sizeBytes: number }> {
  const db = await getRealDb();
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
  const db = await getRealDb();
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
