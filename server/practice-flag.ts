import "server-only";

import { cookies } from "next/headers";

export const PRACTICE_COOKIE = "td_practice";

/** True when this request is on the practice desk. Outside a request (cron), never. */
export async function isPracticeRequest(): Promise<boolean> {
  try {
    return (await cookies()).get(PRACTICE_COOKIE)?.value === "1";
  } catch {
    return false;
  }
}
