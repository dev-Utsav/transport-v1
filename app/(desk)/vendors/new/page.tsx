import type { Metadata } from "next";

import { VendorForm } from "@/components/forms/VendorForm";
import { PageHead } from "@/components/ui/PageHead";
import { getT } from "@/server/lang";

export const metadata: Metadata = { title: "New party" };

export default async function NewVendorPage() {
  const t = await getT();
  return (
    <>
      <PageHead title={t.vendors.new} back={{ href: "/vendors", label: t.vendors.title }} />
      <VendorForm
        t={{ common: t.common, vendors: t.vendors, vendorKinds: t.vendorKinds }}
        initial={{}}
      />
    </>
  );
}
