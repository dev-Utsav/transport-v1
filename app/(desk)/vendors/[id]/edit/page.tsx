import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VendorForm } from "@/components/forms/VendorForm";
import { PageHead } from "@/components/ui/PageHead";
import { paiseToInput } from "@/lib/money";
import { toggleVendor } from "@/server/actions/vendors";
import { getT } from "@/server/lang";
import { getVendor } from "@/server/queries/vendors";

export const metadata: Metadata = { title: "Edit party" };

export default async function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [t, vendor] = await Promise.all([getT(), getVendor(id)]);
  if (!vendor) notFound();
  return (
    <>
      <PageHead title={t.vendors.edit} back={{ href: `/vendors/${id}`, label: vendor.name }} />
      <div className="grid max-w-xl gap-8">
        <VendorForm
          t={{ common: t.common, vendors: t.vendors, vendorKinds: t.vendorKinds }}
          initial={{
            id: String(vendor.id),
            name: vendor.name,
            phone: vendor.phone,
            kind: vendor.kind,
            address: vendor.address,
            gstin: vendor.gstin,
            openingBalance: paiseToInput(vendor.openingBalance),
          }}
        />
        <form action={toggleVendor} className="border-t border-rule pt-6">
          <input type="hidden" name="id" value={vendor.id} />
          <button className="min-h-12 rounded-field px-4 text-[15px] font-semibold text-ink-2 ring-1 ring-rule-strong hover:bg-card">
            {vendor.isActive ? t.common.deactivate : t.common.activate}
          </button>
        </form>
      </div>
    </>
  );
}
