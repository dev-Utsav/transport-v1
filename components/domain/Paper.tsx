import type { ReactNode } from "react";

import type { Settings } from "@/server/settings";

/** A4 sheet on screen; on paper the sheet frame disappears and only the content prints. */
export function Paper({ children }: { children: ReactNode }) {
  return (
    <article
      data-paper
      className="mx-auto w-full max-w-[210mm] rounded-card bg-card p-6 text-[14px] leading-snug text-ink shadow-card ring-1 ring-rule sm:p-10"
    >
      {children}
    </article>
  );
}

/** Letterhead: business name, address, phone, GSTIN, and the document title on the right. */
export function Letterhead({
  settings,
  title,
  fallbackName,
}: {
  settings: Settings;
  title: string;
  fallbackName: string;
}) {
  return (
    <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
      <div className="grid gap-0.5">
        <h1 className="text-[22px] font-bold tracking-tight">
          {settings.businessName || fallbackName}
        </h1>
        {settings.address ? <p>{settings.address}</p> : null}
        <p>
          {[settings.phone, settings.gstin ? `GSTIN ${settings.gstin}` : ""]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <p className="shrink-0 rounded-md border-2 border-ink px-3 py-1 text-[15px] font-bold tracking-wide uppercase">
        {title}
      </p>
    </header>
  );
}
