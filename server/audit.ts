import "server-only";

import type { Tx } from "@/server/db";
import { auditLog } from "@/server/db/schema";

type Action = "create" | "update" | "cancel";

/** Every write goes through here inside its transaction, so the history can't drift from the data. */
export async function logChange(
  tx: Tx,
  entity: string,
  entityId: number,
  action: Action,
  before: unknown,
  after: unknown,
): Promise<void> {
  await tx.insert(auditLog).values({
    entity,
    entityId,
    action,
    before: before ?? null,
    after: after ?? null,
  });
}
