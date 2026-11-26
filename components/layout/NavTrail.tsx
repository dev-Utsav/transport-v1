"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { recordVisit } from "@/components/layout/trail";

/** Remembers each screen shown in this tab (see trail.ts). Renders nothing. */
export function NavTrail() {
  const pathname = usePathname();
  useEffect(() => {
    // Syncs an external store (sessionStorage) after the new screen is on the page.
    const title = document.querySelector("main h1")?.textContent?.trim() ?? "";
    recordVisit({ path: `${pathname}${window.location.search}`, title });
  }, [pathname]);
  return null;
}
