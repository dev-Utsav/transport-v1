import { IntentLink } from "@/components/ui/IntentLink";
import { redirect } from "next/navigation";

import { FlowBoard } from "@/components/domain/FlowBoard";
import { GettingStarted } from "@/components/domain/GettingStarted";
import { Money } from "@/components/domain/Money";
import { RemindButton } from "@/components/domain/RemindButton";
import { SearchBar } from "@/components/domain/SearchBar";
import { TripRow } from "@/components/domain/TripRow";
import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";
import { Section } from "@/components/ui/PageHead";
import { RowList } from "@/components/ui/Rows";
import { formatDayFull, istDay, shiftDay } from "@/lib/dates";
import { PAY_MODES } from "@/lib/types";
import type { Permission } from "@/lib/access";
import { can, requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { isPracticeRequest } from "@/server/practice-flag";
import { flowCounts, setupState } from "@/server/queries/flow";
import { daySummary } from "@/server/queries/money";
import { listTrips } from "@/server/queries/trips";
import { overdueVendors } from "@/server/queries/vendors";
import { getSettings } from "@/server/settings";

export default async function HomePage() {
  const actor = await requireAccess();
  // The work board is the office's view of every parcel; a driver starts on their own trips.
  if (!can(actor, "challans.view")) redirect("/trips");
  const today = istDay();
  const [t, settings, practice] = await Promise.all([getT(), getSettings(), isPracticeRequest()]);
  const [counts, money, onRoad, overdue, setup] = await Promise.all([
    flowCounts(today),
    daySummary(today),
    listTrips("open"),
    overdueVendors(shiftDay(today, -settings.reminderDays)),
    setupState(),
  ]);
  const needsSetup = !practice && (!setup.hasTruck || !setup.hasParty || !settings.businessName);

  const office = (
    [
      { href: "/expenses/new", label: t.home.addExpense, icon: "wallet", need: "expenses.record" },
      {
        href: "/payments/new",
        label: t.home.recordPayment,
        icon: "rupee",
        need: "payments.record",
      },
      {
        href: "/salary/advances",
        label: t.salary.giveAdvance,
        icon: "idCard",
        need: "advances.record",
      },
      { href: "/salary", label: t.nav.salary, icon: "idCard", need: "salary.view" },
      { href: "/reports", label: t.nav.reports, icon: "chart", need: "reports.view" },
    ] satisfies { href: string; label: string; icon: IconName; need: Permission }[]
  ).filter((o) => can(actor, o.need));

  return (
    <div className="grid gap-8">
      <header className="grid gap-4">
        <div>
          <p className="text-[15px] font-semibold text-ink-2">{formatDayFull(today)}</p>
          <h1 className="text-[30px] leading-tight font-bold tracking-tight sm:text-[36px]">
            {t.home.greeting}
          </h1>
        </div>
        <SearchBar
          action="/challans"
          placeholder={t.home.searchPlaceholder}
          label={t.common.search}
        />
      </header>

      {needsSetup ? (
        <GettingStarted
          t={t}
          done={{
            business: Boolean(settings.businessName),
            truck: setup.hasTruck,
            driver: setup.hasDriver,
            party: setup.hasParty,
          }}
        />
      ) : null}

      <FlowBoard t={t} counts={counts} />

      {/* Today's money, on the dark ground: collected by mode, and spent. */}
      <section
        aria-label={t.home.collected}
        className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-road-2 text-road-text shadow-lift"
      >
        <div className="grid gap-2 bg-road p-5">
          <span className="text-[14px] font-semibold text-road-muted">{t.home.collected}</span>
          <span className="num text-[24px] leading-tight font-bold">
            <Money paise={money.collectedTotal} />
          </span>
          <dl className="grid gap-0.5 text-[13px] sm:text-[14px]">
            {PAY_MODES.map((mode) => (
              <div key={mode} className="flex justify-between gap-3">
                <dt className="text-road-muted">{t.modes[mode]}</dt>
                <dd className="num">
                  <Money paise={money.collected[mode]} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <IntentLink
          href="/expenses"
          className="grid content-start gap-2 bg-road p-5 transition-colors duration-150 hover:bg-road-2"
        >
          <span className="text-[14px] font-semibold text-road-muted">{t.home.spent}</span>
          <span className="num text-[24px] leading-tight font-bold">
            <Money paise={money.spent} />
          </span>
        </IntentLink>
      </section>

      {onRoad.length ? (
        <Section
          title={t.home.trucks}
          action={
            <IntentLink
              href="/trips"
              className="-my-3 py-3 text-[15px] font-semibold text-signal-ink hover:underline"
            >
              {t.common.showAll}
            </IntentLink>
          }
        >
          <RowList>
            {onRoad.map((trip) => (
              <TripRow key={trip.id} trip={trip} t={t} />
            ))}
          </RowList>
        </Section>
      ) : null}

      {overdue.length ? (
        <Section
          title={t.home.overdue}
          action={
            <IntentLink
              href="/vendors/reminders"
              className="-my-3 py-3 text-[15px] font-semibold text-signal-ink hover:underline"
            >
              {t.common.showAll}
            </IntentLink>
          }
        >
          <RowList>
            {overdue.slice(0, 5).map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <IntentLink href={`/vendors/${v.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold">{v.name}</div>
                  <div className="text-[14px] text-ink-2">
                    {t.vendors.pending}:{" "}
                    <Money paise={v.balance} tone="due" className="font-semibold" />
                  </div>
                </IntentLink>
                {v.phone ? (
                  <RemindButton t={t} name={v.name} phone={v.phone} balance={v.balance} compact />
                ) : null}
              </li>
            ))}
          </RowList>
        </Section>
      ) : null}

      {office.length ? (
        <Section title={t.office.title}>
          <p className="-mt-2 text-[15px] text-ink-2">{t.office.help}</p>
          <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {office.map((a) => (
              <li key={a.href}>
                <IntentLink
                  href={a.href}
                  className="flex min-h-14 items-center gap-3 rounded-card bg-card px-4 text-[15px] font-semibold shadow-card ring-1 ring-rule hover:ring-rule-strong"
                >
                  <Icon name={a.icon} size={22} className="text-signal" />
                  {a.label}
                </IntentLink>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
