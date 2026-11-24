import type { Metadata } from "next";

import { EmployeeForm } from "@/components/forms/EmployeeForm";
import { PageHead, Section } from "@/components/ui/PageHead";
import { RowLink, RowList } from "@/components/ui/Rows";
import { istDay } from "@/lib/dates";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { driversOffPayroll } from "@/server/queries/salary";

export const metadata: Metadata = { title: "Add staff" };

export default async function NewEmployeePage() {
  await requireAccess("salary.manage");
  const [t, drivers] = await Promise.all([getT(), driversOffPayroll()]);
  return (
    <>
      <PageHead title={t.salary.newEmployee} back={{ href: "/salary", label: t.salary.title }} />
      <div className="grid max-w-xl gap-8">
        <EmployeeForm
          t={{ common: t.common, salary: t.salary, roles: t.roles }}
          initial={{ joinedOn: istDay() }}
        />
        {/* A driver already on the desk is put on salary from their own record, never added twice. */}
        {drivers.length ? (
          <Section title={t.salary.driversOffPayroll}>
            <p className="mb-3 text-[15px] text-ink-2">{t.salary.driversOffPayrollHelp}</p>
            <RowList>
              {drivers.map((d) => (
                <RowLink key={d.id} href={`/salary/staff/${d.id}`} title={d.name} meta={d.phone} />
              ))}
            </RowList>
          </Section>
        ) : null}
      </div>
    </>
  );
}
