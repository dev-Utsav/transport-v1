import { IntentLink } from "@/components/ui/IntentLink";
import type { ReactNode } from "react";

import type { Strings } from "@/content/strings";
import { toggleMaster } from "@/server/actions/masters";

/** A truck or driver row: details, Edit link, Hide / Show (never delete). */
export function MasterRow({
  t,
  kind,
  id,
  isActive,
  editHref,
  title,
  meta,
}: {
  t: Strings;
  kind: "truck" | "driver";
  id: number;
  isActive: boolean;
  editHref: string;
  title: ReactNode;
  meta: string;
}) {
  return (
    <li
      className={`flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5 ${isActive ? "" : "opacity-60"}`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-semibold">{title}</div>
        <div className="truncate text-[14px] text-ink-2">
          {[meta, isActive ? "" : t.common.inactive].filter(Boolean).join(" · ")}
        </div>
      </div>
      <IntentLink
        href={editHref}
        className="min-h-11 rounded-field px-3 py-2.5 text-[14px] font-semibold ring-1 ring-rule-strong hover:bg-paper"
      >
        {t.common.edit}
      </IntentLink>
      <form action={toggleMaster}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <button className="min-h-11 rounded-field px-3 text-[14px] font-semibold text-ink-2 hover:bg-paper">
          {isActive ? t.common.deactivate : t.common.activate}
        </button>
      </form>
    </li>
  );
}
