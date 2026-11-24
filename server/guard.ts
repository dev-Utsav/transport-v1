import "server-only";

import { revalidatePath } from "next/cache";

/** Every screen reads live totals, so one write refreshes the whole desk. */
export function refreshDesk(): void {
  revalidatePath("/", "layout");
}
