import type { Metadata } from "next";

import { MasterRow } from "@/components/domain/MasterRow";
import { TruckForm } from "@/components/forms/MasterForms";
import { PageHead, Section } from "@/components/ui/PageHead";
import { RowList } from "@/components/ui/Rows";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { truckOptions } from "@/server/queries/trips";

export const metadata: Metadata = { title: "Trucks" };

export default async function TrucksPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAccess("masters.manage");
  const { edit } = await searchParams;
  const [t, trucks] = await Promise.all([getT(), truckOptions(true)]);
  const editing = trucks.find((tk) => String(tk.id) === edit);
  return (
    <>
      <PageHead back={{ href: "/settings", label: t.settings.title }} title={t.settings.trucks} />
      <div className="grid max-w-2xl gap-8">
        <Section title={editing ? `${t.common.edit} · ${editing.number}` : t.settings.newTruck}>
          <TruckForm
            key={editing?.id ?? "new"}
            t={{ common: t.common, settings: t.settings, owners: t.owners }}
            initial={
              editing
                ? {
                    id: String(editing.id),
                    number: editing.number,
                    type: editing.type,
                    owner: editing.owner,
                    ownerName: editing.ownerName,
                  }
                : {}
            }
          />
        </Section>
        {trucks.length ? (
          <RowList>
            {trucks.map((tk) => (
              <MasterRow
                key={tk.id}
                t={t}
                kind="truck"
                id={tk.id}
                isActive={tk.isActive}
                editHref={`/settings/trucks?edit=${tk.id}`}
                title={<span className="font-mono tracking-wide">{tk.number}</span>}
                meta={[tk.type, t.owners[tk.owner], tk.ownerName].filter(Boolean).join(" · ")}
              />
            ))}
          </RowList>
        ) : null}
      </div>
    </>
  );
}
