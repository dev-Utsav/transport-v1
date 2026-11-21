"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { getServerTour, getTour, setTour, subscribeTour } from "@/components/tour/tourStore";
import type { Strings } from "@/content/strings";

// The overlay's code loads only while a tour is running.
const TourOverlay = dynamic(
  () => import("@/components/tour/TourOverlay").then((m) => m.TourOverlay),
  { ssr: false },
);

/**
 * Mounted once in the shell. Starts the tour when Home opens with ?tour=start (after the
 * practice desk is set up), and ends it if the person leaves the practice desk.
 */
export function TourHost({ t, isPractice }: { t: Strings["tour"]; isPractice: boolean }) {
  const tour = useSyncExternalStore(subscribeTour, getTour, getServerTour);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("tour") !== "start") return;
    setTour({ step: 0, pending: null, paused: false });
    url.searchParams.delete("tour");
    router.replace(url.pathname + url.search);
  }, [pathname, router]);

  useEffect(() => {
    if (!isPractice && getTour()) setTour(null);
  }, [isPractice]);

  if (!tour || !isPractice) return null;
  if (tour.paused) {
    return (
      <button
        type="button"
        onClick={() => setTour({ ...tour, paused: false })}
        className="fixed bottom-24 left-4 z-[70] min-h-12 rounded-pill bg-road px-5 text-[15px] font-semibold text-road-text shadow-lift lg:bottom-6"
      >
        ▶ {t.resume}
      </button>
    );
  }
  return <TourOverlay t={t} state={tour} pathname={pathname} />;
}
