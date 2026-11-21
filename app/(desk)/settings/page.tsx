import type { Metadata } from "next";

import { Saved } from "@/components/domain/Saved";
import { TourEntry } from "@/components/domain/TourEntry";
import { SettingsForm } from "@/components/forms/SettingsForm";
import { LangSwitch } from "@/components/layout/LangSwitch";
import { ButtonAnchor } from "@/components/ui/Button";
import { PageHead, Section } from "@/components/ui/PageHead";
import { RowList, RowLink } from "@/components/ui/Rows";
import { categoryLabel } from "@/content/strings";
import { formatRate } from "@/lib/gst";
import { paiseToInput } from "@/lib/money";
import { expenseCategoryList } from "@/lib/types";
import { addCategory } from "@/server/actions/settings";
import { listBackups } from "@/server/backup";
import { getLang, getT } from "@/server/lang";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Settings" };

const when = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ saved }, t, lang, settings, backups] = await Promise.all([
    searchParams,
    getT(),
    getLang(),
    getSettings(),
    listBackups(),
  ]);
  return (
    <>
      <Saved show={saved === "1"} label={t.common.saved} />
      <PageHead title={t.settings.title} />
      <div className="grid max-w-2xl gap-10">
        <TourEntry t={t} />

        <Section title={t.common.language}>
          <div className="max-w-xs">
            <LangSwitch lang={lang} label={t.common.language} />
          </div>
        </Section>

        <Section title={`${t.settings.trucks} · ${t.settings.drivers}`}>
          <RowList>
            <RowLink href="/settings/trucks" title={t.settings.trucks} />
            <RowLink href="/settings/drivers" title={t.settings.drivers} />
          </RowList>
        </Section>

        <SettingsForm
          t={{ common: t.common, settings: t.settings, gstModes: t.gstModes }}
          initial={{
            businessName: settings.businessName,
            address: settings.address,
            phone: settings.phone,
            gstin: settings.gstin,
            gstMode: settings.gstMode,
            gstRate: formatRate(settings.gstRateBp).replace("%", ""),
            challanPrefix: settings.challanPrefix,
            nextChallanNo: String(settings.nextChallanNo),
            openingCash: paiseToInput(settings.openingCash),
            reminderDays: String(settings.reminderDays),
          }}
        />

        <Section title={t.settings.categories}>
          <div className="grid gap-4 rounded-card bg-card p-5 shadow-card ring-1 ring-rule">
            <ul className="flex flex-wrap gap-2">
              {expenseCategoryList(settings.expenseCategories).map((cat) => (
                <li
                  key={cat}
                  className="rounded-pill bg-paper-deep px-3 py-1.5 text-[15px] font-semibold"
                >
                  {categoryLabel(t, cat)}
                </li>
              ))}
            </ul>
            <form action={addCategory} className="flex gap-2">
              <label className="flex-1">
                <span className="sr-only">{t.settings.addCategory}</span>
                <input
                  name="category"
                  required
                  maxLength={40}
                  placeholder={t.settings.addCategory}
                  className="block min-h-12 w-full rounded-field bg-card px-4 text-[16px] ring-1 ring-rule-strong focus:ring-2 focus:ring-signal focus:outline-none"
                />
              </label>
              <button className="min-h-12 rounded-field bg-road px-5 font-semibold text-road-text">
                +
              </button>
            </form>
          </div>
        </Section>

        <Section title={t.settings.backup}>
          <div className="grid gap-4 rounded-card bg-card p-5 shadow-card ring-1 ring-rule">
            <p className="text-ink-2">{t.settings.backupHelp}</p>
            <ButtonAnchor
              href="/api/backup"
              variant="secondary"
              icon="download"
              className="justify-self-start"
            >
              {t.settings.downloadNow}
            </ButtonAnchor>
            <h3 className="text-[15px] font-semibold">{t.settings.lastBackups}</h3>
            {backups.length ? (
              <ul className="grid gap-1 text-[15px]">
                {backups.slice(0, 7).map((b) => (
                  <li key={b.id}>
                    <a href={`/api/backup/${b.id}`} className="underline underline-offset-2">
                      {when.format(b.takenAt)}
                    </a>{" "}
                    <span className="text-ink-2">· {Math.round(b.sizeBytes / 1024)} KB</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-2">{t.settings.noBackups}</p>
            )}
          </div>
        </Section>
      </div>
    </>
  );
}
