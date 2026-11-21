import type { Metadata } from "next";

import { MasterRow } from "@/components/domain/MasterRow";
import { DriverForm } from "@/components/forms/MasterForms";
import { PageHead, Section } from "@/components/ui/PageHead";
import { RowList } from "@/components/ui/Rows";
import { getT } from "@/server/lang";
import { driverOptions } from "@/server/queries/trips";

export const metadata: Metadata = { title: "Drivers" };

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const [t, drivers] = await Promise.all([getT(), driverOptions(true)]);
  const editing = drivers.find((d) => String(d.id) === edit);
  return (
    <>
      <PageHead back={{ href: "/settings", label: t.settings.title }} title={t.settings.drivers} />
      <div className="grid max-w-2xl gap-8">
        <Section title={editing ? `${t.common.edit} · ${editing.name}` : t.settings.newDriver}>
          <DriverForm
            key={editing?.id ?? "new"}
            t={{ common: t.common, settings: t.settings }}
            initial={
              editing
                ? {
                    id: String(editing.id),
                    name: editing.name,
                    phone: editing.phone,
                    licence: editing.licence,
                  }
                : {}
            }
          />
        </Section>
        {drivers.length ? (
          <RowList>
            {drivers.map((d) => (
              <MasterRow
                key={d.id}
                t={t}
                kind="driver"
                id={d.id}
                isActive={d.isActive}
                editHref={`/settings/drivers?edit=${d.id}`}
                title={d.name}
                meta={[d.phone, d.licence].filter(Boolean).join(" · ")}
              />
            ))}
          </RowList>
        ) : null}
      </div>
    </>
  );
}
