import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Devanagari } from "next/font/google";

import "./globals.css";
import { PAPER_HEX } from "@/lib/theme";
import { getLang } from "@/server/lang";

const plex = IBM_Plex_Sans({ subsets: ["latin"], display: "swap", variable: "--font-plex" });
// Devanagari glyphs only; loaded when the page actually uses Hindi text.
const plexDeva = IBM_Plex_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-plex-deva",
  preload: false,
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
  variable: "--font-plex-mono",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Transport Desk", template: "%s · Transport Desk" },
  description: "Trips, challans, parties, payments, expenses and salary for the Kadodara office.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Transport Desk", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: PAPER_HEX,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html
      lang={lang === "hi" ? "hi-IN" : "en-IN"}
      className={`${plex.variable} ${plexDeva.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
