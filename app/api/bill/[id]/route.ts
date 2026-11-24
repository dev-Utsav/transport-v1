import { eq } from "drizzle-orm";

import { getDb } from "@/server/db";
import { billPhotos } from "@/server/db/schema";
import { apiDenied } from "@/server/auth";

/** Serves one bill photo. Behind the login (proxy), private, never cached by shared caches. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await apiDenied("expenses.view");
  if (denied) return denied;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [photo] = await db.select().from(billPhotos).where(eq(billPhotos.expenseId, id));
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "private, max-age=86400",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
