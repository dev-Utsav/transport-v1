import "server-only";

import { sessionUserId } from "@/server/auth";
import type { Tx } from "@/server/db";
import { auditLog } from "@/server/db/schema";
import { isPracticeRequest } from "@/server/practice-flag";

type Action = "create" | "update" | "cancel";

/**
 * Every write goes through here inside its transaction, so the history can't drift from the data.
 * Records who did it; on the practice desk the actor is left empty (logins live in the real
 * database, so a practice row can't point at one).
 */
export async function logChange(
  tx: Tx,
  entity: string,
  entityId: number,
  action: Action,
  before: unknown,
  after: unknown,
): Promise<void> {
  const [actorId, practice] = await Promise.all([sessionUserId(), isPracticeRequest()]);
  await tx.insert(auditLog).values({
    actorId: practice ? null : actorId,
    entity,
    entityId,
    action,
    before: before ?? null,
    after: after ?? null,
  });
}
