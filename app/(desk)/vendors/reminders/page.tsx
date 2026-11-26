import type { Metadata } from "next";
import { IntentLink } from "@/components/ui/IntentLink";

import { FlowBar } from "@/components/domain/FlowBar";
import { Money } from "@/components/domain/Money";
import { RemindButton } from "@/components/domain/RemindButton";
import { PageHead } from "@/components/ui/PageHead";
import { Empty, RowList } from "@/components/ui/Rows";
import { fill } from "@/content/strings";
import { formatDay, istDay, shiftDay } from "@/lib/dates";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { overdueVendors } from "@/server/queries/vendors";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Reminders" };

export default async function RemindersPage() {
  await requireAccess("parties.view");
  const [t, settings] = await Promise.all([getT(), getSettings()]);
  const rows = await overdueVendors(shiftDay(istDay(), -settings.reminderDays));
  return (
    <>
      <FlowBar t={t} current="collect" />
      <PageHead
        back={{ href: "/vendors", label: t.vendors.title }}
        title={t.vendors.reminders}
        sub={fill(t.vendors.remindersHelp, { days: settings.reminderDays })}
      />
      {rows.length ? (
        <RowList>
          {rows.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
              <IntentLink href={`/vendors/${v.id}`} className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-semibold">{v.name}</div>
                <div className="text-[14px] text-ink-2">
                  {v.oldestDue && v.oldestDue !== "0000-00-00"
                    ? `${t.vendors.oldestDue}: ${formatDay(v.oldestDue)}`
                    : t.vendors.openingRow}
                </div>
              </IntentLink>
              <Money paise={v.balance} tone="due" className="text-[17px] font-bold" />
              {v.phone ? (
                <RemindButton t={t} name={v.name} phone={v.phone} balance={v.balance} compact />
              ) : null}
            </li>
          ))}
        </RowList>
      ) : (
        <Empty>{t.home.overdueEmpty}</Empty>
      )}
    </>
  );
}
