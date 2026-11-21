import "server-only";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { env } from "@/server/env";

/** Second lock behind the proxy: every server action checks the session itself. */
export async function assertAdmin(): Promise<void> {
  if (!env.APP_PASSWORD) {
    if (env.NODE_ENV === "production") throw new Error("APP_PASSWORD is not set");
    return;
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySession(env.APP_PASSWORD, token))) throw new Error("Not signed in");
}

/** Every screen reads live totals, so one write refreshes the whole desk. */
export function refreshDesk(): void {
  revalidatePath("/", "layout");
}
