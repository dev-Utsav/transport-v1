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
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b-2 border-ink pb-4">
      <div className="grid gap-0.5">
        {/* Not a heading: every page with a letterhead already has its one h1 in PageHead. */}
        <p className="text-[22px] font-bold tracking-tight">
          {settings.businessName || fallbackName}
        </p>
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
