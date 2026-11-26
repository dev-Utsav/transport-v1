"use client";

import { useLinkStatus } from "next/link";

/**
 * Child of a `<Link>`: renders a hidden marker while that link's navigation is pending. CSS
 * (`styles/motion.css`) turns the marker into a top progress bar and a progress cursor.
 *
 * Why not `app/(desk)/loading.tsx`: it wraps every page in Suspense, so Next streams the response.
 * The 200 status goes out before the page runs, so `requireAccess()` -> `notFound()` answers 200
 * instead of 404, and with JavaScript off the streamed page stays hidden. Desk pages are dynamic,
 * and prefetch only fires on intent (IntentLink), so click feedback has to come from the link.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <span data-link-pending hidden /> : null;
}
