import type { Metadata } from "next";

import { Money } from "@/components/domain/Money";
import { SearchBar } from "@/components/domain/SearchBar";
import { ButtonLink } from "@/components/ui/Button";
import { PageHead } from "@/components/ui/PageHead";
import { COLLECT_TONE, Pill } from "@/components/ui/Pill";
import { Empty, RowList, RowLink } from "@/components/ui/Rows";
import { formatChallanNo } from "@/lib/challan-no";
import { formatDay, isDay } from "@/lib/dates";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { searchChallans } from "@/server/queries/challans";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Challans" };

export default async function ChallansPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; day?: string }>;
}) {
  await requireAccess("challans.view");
  const { q = "", day = "" } = await searchParams;
  const validDay = isDay(day) ? day : undefined;
  const [t, settings, rows] = await Promise.all([
    getT(),
    getSettings(),
    searchChallans({ q, ...(validDay ? { day: validDay } : {}) }),
  ]);
  return (
    <>
      <PageHead
        title={t.challans.title}
        actions={
          <ButtonLink href="/challans/new" icon="plus">
            {t.challans.new}
          </ButtonLink>
        }
      />
      <div className="grid gap-5">
        <SearchBar
          action="/challans"
          defaultValue={q}
          placeholder={t.challans.searchHint}
          label={t.common.search}
        >
          <label className="w-40 shrink-0">
            <span className="sr-only">{t.common.date}</span>
            <input
              type="date"
              name="day"
              defaultValue={validDay ?? ""}
              className="block min-h-13 w-full rounded-field bg-card px-3 text-[16px] shadow-card ring-1 ring-rule-strong focus:ring-2 focus:ring-signal focus:outline-none"
            />
          </label>
        </SearchBar>
        {rows.length ? (
          <RowList>
            {rows.map((r) => (
              <RowLink
                key={r.id}
                href={`/challans/${r.id}`}
                muted={r.isCancelled}
                title={
                  <>
                    <span className="mr-2 font-mono text-[15px] font-medium">
                      {formatChallanNo(r.no, settings.challanPrefix)}
                    </span>
                    {r.senderName} → {r.receiverName}
                  </>
                }
                meta={[
                  formatDay(r.bookedOn),
                  `${r.fromPlace} → ${r.toPlace}`,
                  `${r.packages} ${t.challans.packages}`,
                  r.truckNumber,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                aside={<Money paise={r.total} />}
                asideSub={
                  r.isCancelled ? (
                    <Pill tone="neutral">{t.common.cancelled}</Pill>
                  ) : (
                    <Pill tone={COLLECT_TONE[r.state]}>{t.collect[r.state]}</Pill>
                  )
                }
              />
            ))}
          </RowList>
        ) : (
          <Empty>{t.common.nothing}</Empty>
        )}
      </div>
    </>
  );
}
