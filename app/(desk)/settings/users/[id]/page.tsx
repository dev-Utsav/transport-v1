import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ResetPasswordForm, ToggleUserForm } from "@/components/forms/UserAdminForms";
import { UserForm } from "@/components/forms/UserForm";
import { PageHead, Section } from "@/components/ui/PageHead";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { getUser, roleOptions, staffForLogins } from "@/server/queries/users";

export const metadata: Metadata = { title: "Edit user" };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAccess("users.manage");
  const id = Number((await params).id);
  const [t, user, roles, staff] = await Promise.all([
    getT(),
    Number.isInteger(id) && id > 0 ? getUser(id) : null,
    roleOptions(),
    staffForLogins(),
  ]);
  if (!user) notFound();
  return (
    <>
      <PageHead back={{ href: "/settings/users", label: t.users.title }} title={user.name} />
      <div className="grid max-w-xl gap-10">
        <UserForm
          t={{
            common: t.common,
            users: t.users,
            roleNames: t.roleNames,
            roleHelp: t.roleHelp,
            roles: t.roles,
          }}
          initial={{
            id: String(user.id),
            name: user.name,
            login: user.login,
            phone: user.phone,
            staffId: user.staffId ? String(user.staffId) : "",
            roleIds: user.roleIds.join(","),
          }}
          roles={roles}
          staff={staff}
        />
        <Section title={t.users.resetPassword}>
          <ResetPasswordForm t={{ common: t.common, users: t.users }} id={user.id} />
        </Section>
        <ToggleUserForm
          t={{ common: t.common, users: t.users }}
          id={user.id}
          isActive={user.isActive}
        />
      </div>
    </>
  );
}
