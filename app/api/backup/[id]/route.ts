import { eq } from "drizzle-orm";

import { getDb } from "@/server/db";
import { backups } from "@/server/db/schema";

/** Download one of the nightly backups (gzip JSON), behind the login. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [row] = await db.select().from(backups).where(eq(backups.id, id));
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="transport-desk-backup-${row.takenAt.toISOString().slice(0, 10)}.json.gz"`,
      "Cache-Control": "private, no-store",
    },
  });
}
