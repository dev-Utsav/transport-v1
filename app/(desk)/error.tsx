"use client";

import { useEffect } from "react";

import { stringsFor } from "@/content/strings";

/** Error boundary for every desk screen. Reads the language from <html lang>, no server call. */
export default function DeskError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const t = stringsFor(
    typeof document !== "undefined" && document.documentElement.lang.startsWith("hi") ? "hi" : "en",
  );
  return (
    <div
      role="alert"
      className="grid max-w-md gap-4 rounded-card bg-card p-6 shadow-card ring-1 ring-rule"
    >
      <h1 className="text-[22px] font-bold">{t.common.errorTitle}</h1>
      <p className="text-ink-2">{t.common.errorBody}</p>
      {error.digest ? <p className="font-mono text-[13px] text-ink-3">{error.digest}</p> : null}
      <button
        onClick={reset}
        className="min-h-12 justify-self-start rounded-field bg-signal px-5 font-semibold text-card"
      >
        {t.common.tryAgain}
      </button>
    </div>
  );
}
