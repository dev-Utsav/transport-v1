import { timingSafeEqual } from "@/lib/session";
import { takeBackup } from "@/server/backup";
import { env } from "@/server/env";

/** Vercel Cron (vercel.json, 02:00 IST) calls this with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(auth, `Bearer ${secret}`))
    return new Response("Unauthorized", { status: 401 });
  const result = await takeBackup();
  return Response.json({ ok: true, ...result });
}
