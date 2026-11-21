import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/server/db";
import { auditLog } from "@/server/db/schema";

/** Change history of one record, newest first. */
export async function historyOf(entity: string, entityId: number) {
  const db = await getDb();
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      at: auditLog.at,
      before: auditLog.before,
      after: auditLog.after,
    })
    .from(auditLog)
    .where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, entityId)))
    .orderBy(desc(auditLog.at))
    .limit(30);
}
