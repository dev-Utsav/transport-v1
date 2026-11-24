import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CancelEntry } from "@/components/domain/CancelEntry";
import { History } from "@/components/domain/History";
import { Money } from "@/components/domain/Money";
import { Card, PageHead } from "@/components/ui/PageHead";
import { Pill } from "@/components/ui/Pill";
import { Facts } from "@/components/ui/Rows";
import { categoryLabel } from "@/content/strings";
import { formatDayFull } from "@/lib/dates";
import { requireAccess } from "@/server/auth";
import { cancelExpense } from "@/server/actions/money";
import { getT } from "@/server/lang";
import { historyOf } from "@/server/queries/audit";
import { getExpense } from "@/server/queries/money";
import { getTrip, truckOptions } from "@/server/queries/trips";

export const metadata: Metadata = { title: "Expense" };

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("expenses.view");
  const id = Number((await params).id);
  const [t, expense, history, trucks] = await Promise.all([
    getT(),
    getExpense(id),
    historyOf("expense", id),
    truckOptions(true),
  ]);
  if (!expense) notFound();
  const trip = expense.tripId ? await getTrip(expense.tripId) : null;
  const truck = trucks.find((tk) => tk.id === expense.truckId);
  return (
    <>
      <PageHead
        back={{ href: `/expenses?month=${expense.spentOn.slice(0, 7)}`, label: t.expenses.title }}
        title={categoryLabel(t, expense.category)}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {formatDayFull(expense.spentOn)}
            {expense.isCancelled ? <Pill tone="neutral">{t.common.cancelled}</Pill> : null}
          </span>
        }
      />
      <div className="grid max-w-2xl gap-6">
        <Card className="grid gap-5 p-5 sm:p-6">
          <p className="num text-[32px] font-bold">
            <Money paise={expense.amount} />
          </p>
          <Facts
            items={[
              { label: t.common.mode, value: t.modes[expense.mode] },
              {
                label: t.expenses.truck,
                value: truck ? <span className="font-mono">{truck.number}</span> : "—",
              },
              {
                label: t.expenses.trip,
                value: trip ? (
                  <Link href={`/trips/${trip.id}`} className="underline underline-offset-2">
                    {trip.fromPlace} → {trip.toPlace}
                  </Link>
                ) : (
                  "—"
                ),
              },
              { label: t.common.note, value: expense.note || "—" },
            ]}
          />
          {expense.hasPhoto ? (
            <a
              href={`/api/bill/${expense.id}`}
              target="_blank"
              rel="noopener"
              className="block overflow-hidden rounded-field ring-1 ring-rule"
            >
              {/* Private, login-only image route: next/image's optimiser can't fetch it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/bill/${expense.id}`}
                alt={t.expenses.photo}
                className="max-h-[480px] w-full object-contain"
                loading="lazy"
              />
            </a>
          ) : null}
        </Card>
        <History t={t} rows={history} />
        {expense.isCancelled ? null : <CancelEntry t={t} id={expense.id} action={cancelExpense} />}
      </div>
    </>
  );
}
