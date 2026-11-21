import type { Metadata } from "next";

import { EmployeeForm } from "@/components/forms/EmployeeForm";
import { PageHead } from "@/components/ui/PageHead";
import { istDay } from "@/lib/dates";
import { getT } from "@/server/lang";

export const metadata: Metadata = { title: "Add staff" };

export default async function NewEmployeePage() {
  const t = await getT();
  return (
    <>
      <PageHead title={t.salary.newEmployee} back={{ href: "/salary", label: t.salary.title }} />
      <EmployeeForm
        t={{ common: t.common, salary: t.salary, roles: t.roles }}
        initial={{ joinedOn: istDay() }}
      />
    </>
  );
}
