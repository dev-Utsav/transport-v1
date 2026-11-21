import type { MetadataRoute } from "next";

import { PAPER_HEX } from "@/lib/theme";

/** "Add to Home screen" on the admin's phone opens the desk like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Transport Desk",
    short_name: "Desk",
    description: "Trips, challans, parties and payments for the Kadodara office.",
    start_url: "/",
    display: "standalone",
    background_color: PAPER_HEX,
    theme_color: PAPER_HEX,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
