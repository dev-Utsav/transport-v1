import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmployeeForm } from "@/components/forms/EmployeeForm";
import { PageHead } from "@/components/ui/PageHead";
import { paiseToInput } from "@/lib/money";
import { toggleMaster } from "@/server/actions/masters";
import { getT } from "@/server/lang";
import { getEmployee } from "@/server/queries/salary";

export const metadata: Metadata = { title: "Edit staff" };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [t, employee] = await Promise.all([getT(), getEmployee(id)]);
  if (!employee) notFound();
  return (
    <>
      <PageHead
        title={t.salary.editEmployee}
        back={{ href: `/salary/${id}`, label: employee.name }}
      />
      <div className="grid max-w-xl gap-8">
        <EmployeeForm
          t={{ common: t.common, salary: t.salary, roles: t.roles }}
          initial={{
            id: String(employee.id),
            name: employee.name,
            phone: employee.phone,
            role: employee.role,
            monthlySalary: paiseToInput(employee.monthlySalary),
            joinedOn: employee.joinedOn,
          }}
        />
        <form action={toggleMaster} className="border-t border-rule pt-6">
          <input type="hidden" name="kind" value="employee" />
          <input type="hidden" name="id" value={employee.id} />
          <button className="min-h-12 rounded-field px-4 text-[15px] font-semibold text-ink-2 ring-1 ring-rule-strong hover:bg-card">
            {employee.isActive ? t.common.deactivate : t.common.activate}
          </button>
        </form>
      </div>
    </>
  );
}
