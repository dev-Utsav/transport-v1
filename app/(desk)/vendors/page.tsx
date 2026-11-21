import type { Metadata } from "next";
import Link from "next/link";

import { Money } from "@/components/domain/Money";
import { SearchBar } from "@/components/domain/SearchBar";
import { ButtonLink } from "@/components/ui/Button";
import { PageHead } from "@/components/ui/PageHead";
import { Pill } from "@/components/ui/Pill";
import { Empty, RowList, RowLink } from "@/components/ui/Rows";
import { getT } from "@/server/lang";
import { listVendorBalances } from "@/server/queries/vendors";

export const metadata: Metadata = { title: "Parties" };

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; due?: string }>;
}) {
  const { q = "", due } = await searchParams;
  const dueOnly = due === "1";
  const [t, rows] = await Promise.all([getT(), listVendorBalances({ q, dueOnly })]);
  const pending = rows.reduce((s, r) => s + Math.max(0, r.balance), 0);
  const tab = "inline-flex min-h-11 items-center rounded-pill px-4 text-[15px] font-semibold";
  return (
    <>
      <PageHead
        title={t.vendors.title}
        sub={
          <>
            {t.vendors.pending}: <Money paise={pending} tone="due" className="font-semibold" />
          </>
        }
        actions={
          <>
            <ButtonLink href="/vendors/reminders" variant="secondary" icon="bell">
              {t.vendors.reminders}
            </ButtonLink>
            <ButtonLink href="/vendors/new" icon="plus">
              {t.vendors.new}
            </ButtonLink>
          </>
        }
      />
      <div className="grid gap-4">
        <SearchBar
          action="/vendors"
          defaultValue={q}
          placeholder={t.vendors.searchHint}
          label={t.common.search}
        >
          {dueOnly ? <input type="hidden" name="due" value="1" /> : null}
        </SearchBar>
        <nav className="flex gap-2" aria-label={t.vendors.title}>
          <Link
            href={`/vendors${q ? `?q=${encodeURIComponent(q)}` : ""}`}
            aria-current={!dueOnly ? "page" : undefined}
            className={`${tab} ${!dueOnly ? "bg-road text-road-text" : "bg-card text-ink-2 ring-1 ring-rule"}`}
          >
            {t.common.all}
          </Link>
          <Link
            href={`/vendors?due=1${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            aria-current={dueOnly ? "page" : undefined}
            className={`${tab} ${dueOnly ? "bg-road text-road-text" : "bg-card text-ink-2 ring-1 ring-rule"}`}
          >
            {t.vendors.dueOnly}
          </Link>
        </nav>
        {rows.length ? (
          <RowList>
            {rows.map((v, i) => (
              <RowLink
                key={v.id}
                tour={i === 0 ? "party-row" : undefined}
                href={`/vendors/${v.id}`}
                muted={!v.isActive}
                title={v.name}
                meta={[t.vendorKinds[v.kind], v.phone, v.isActive ? "" : t.common.inactive]
                  .filter(Boolean)
                  .join(" · ")}
                aside={<Money paise={v.balance} tone={v.balance > 0 ? "due" : undefined} />}
                asideSub={
                  v.balance > 0 ? (
                    <Pill tone="due">{t.vendors.pending}</Pill>
                  ) : v.balance < 0 ? (
                    <Pill tone="in">{t.vendors.paid}</Pill>
                  ) : null
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
