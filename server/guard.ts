import "server-only";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { classifyFailure, errorCode } from "@/lib/failure";
import { formValues } from "@/lib/form";
import type { FormState } from "@/lib/form";
import { AccessError } from "@/server/auth";

/** Every screen reads live totals, so one write refreshes the whole desk. */
export function refreshDesk(): void {
  revalidatePath("/", "layout");
}

/**
 * Runs a form action so a failure never replaces the screen. Without it, a thrown error goes to
 * the error boundary and everything typed is lost (a Supabase blip mid-booking, say).
 * - redirect() / notFound() pass through (Next throws them on purpose);
 * - signed out → the login page; no permission → "denied";
 * - anything else → logged with a short reference, and the form comes back with what was typed
 *   and a plain message. The raw error never reaches the browser.
 */
export async function guardForm(
  formData: FormData,
  save: () => Promise<FormState>,
): Promise<FormState> {
  try {
    return await save();
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AccessError && err.reason === "signedOut") redirect("/login");
    const values = formValues(formData);
    if (err instanceof AccessError) return { ok: false, errors: {}, values, failure: "denied" };
    const ref = crypto.randomUUID().slice(0, 8);
    const failure = classifyFailure(errorCode(err));
    console.error(`[save failed] ref=${ref} failure=${failure}`, err);
    return { ok: false, errors: {}, values, failure, ref };
  }
}
