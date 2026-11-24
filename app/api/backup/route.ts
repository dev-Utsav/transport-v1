import { istDay } from "@/lib/dates";
import { exportAll } from "@/server/backup";
import { apiDenied } from "@/server/auth";

/** Download a full backup right now (behind the login). */
export async function GET() {
  const denied = await apiDenied("backup.download");
  if (denied) return denied;
  return new Response(await exportAll(), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="transport-desk-backup-${istDay()}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
