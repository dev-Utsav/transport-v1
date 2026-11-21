import type { Metadata } from "next";

import { FlowBar } from "@/components/domain/FlowBar";
import { PaymentForm } from "@/components/forms/PaymentForm";
import { PageHead } from "@/components/ui/PageHead";
import { formatChallanNo } from "@/lib/challan-no";
import { formatDay, istDay } from "@/lib/dates";
import { formatMoney, paiseToInput } from "@/lib/money";
import { PAY_MODES } from "@/lib/types";
import { getT } from "@/server/lang";
import { openChallansFor } from "@/server/queries/challans";
import { getVendorBalance, vendorOptions } from "@/server/queries/vendors";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Record payment" };

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string; challan?: string; mode?: string }>;
}) {
  const { vendor, challan, mode } = await searchParams;
  const vendorId = Number(vendor) || 0;
  const [t, settings, parties, open, balance] = await Promise.all([
    getT(),
    getSettings(),
    vendorOptions(),
    vendorId ? openChallansFor(vendorId) : Promise.resolve([]),
    vendorId ? getVendorBalance(vendorId) : Promise.resolve(null),
  ]);
  const picked = open.find((c) => String(c.id) === challan);
  const back = challan ? `/challans/${challan}?saved=1` : "";
  return (
    <>
      <FlowBar t={t} current="collect" />
      <PageHead
        title={t.payments.new}
        back={{ href: balance ? `/vendors/${vendorId}` : "/", label: balance?.name ?? t.nav.home }}
      />
      <PaymentForm
        key={`${vendorId}-${challan ?? ""}`}
        t={{ common: t.common, payments: t.payments, modes: t.modes, vendors: t.vendors }}
        parties={parties.map(({ id, name }) => ({ id, name }))}
        openChallans={open.map((c) => ({
          id: c.id,
          due: c.due,
          label: `${formatChallanNo(c.no, settings.challanPrefix)} · ${formatDay(c.bookedOn)} · ${t.challans.due} ${formatMoney(c.due)}`,
        }))}
        balance={balance?.balance ?? null}
        initial={{
          vendorId: vendorId ? String(vendorId) : "",
          challanId: picked ? String(picked.id) : "",
          amount: picked ? paiseToInput(picked.due) : "",
          paidOn: istDay(),
          mode: PAY_MODES.find((m) => m === mode) ?? "cash",
          back,
        }}
      />
    </>
  );
}
