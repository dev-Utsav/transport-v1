import type { Metadata } from "next";

import { ExpenseForm } from "@/components/forms/ExpenseForm";
import { PageHead } from "@/components/ui/PageHead";
import { categoryLabel } from "@/content/strings";
import { formatDay, istDay } from "@/lib/dates";
import { expenseCategoryList } from "@/lib/types";
import { getT } from "@/server/lang";
import { tripOptions, truckOptions } from "@/server/queries/trips";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Add expense" };

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string }>;
}) {
  const { trip } = await searchParams;
  const [t, settings, trucks, trips] = await Promise.all([
    getT(),
    getSettings(),
    truckOptions(),
    tripOptions(),
  ]);
  const preset = trips.find((tr) => String(tr.id) === trip);
  const presetTruck = preset ? trucks.find((tk) => tk.number === preset.truckNumber) : undefined;
  return (
    <>
      <PageHead
        title={t.expenses.new}
        back={
          preset
            ? { href: `/trips/${preset.id}`, label: preset.truckNumber }
            : { href: "/expenses", label: t.expenses.title }
        }
      />
      <ExpenseForm
        t={{ common: t.common, expenses: t.expenses, modes: t.modes }}
        categories={expenseCategoryList(settings.expenseCategories).map((cat) => ({
          value: cat,
          label: categoryLabel(t, cat),
        }))}
        trucks={trucks.map(({ id, number }) => ({ id, number }))}
        trips={trips.map((tr) => ({
          id: tr.id,
          label: `${tr.truckNumber} · ${tr.toPlace} · ${formatDay(tr.departOn)}`,
        }))}
        initial={{
          spentOn: istDay(),
          mode: "cash",
          tripId: preset ? String(preset.id) : "",
          truckId: presetTruck ? String(presetTruck.id) : "",
        }}
      />
    </>
  );
}
