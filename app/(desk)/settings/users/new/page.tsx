import type { Metadata } from "next";

import { UserForm } from "@/components/forms/UserForm";
import { PageHead } from "@/components/ui/PageHead";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { roleOptions, staffForLogins } from "@/server/queries/users";

export const metadata: Metadata = { title: "Add user" };

export default async function NewUserPage() {
  await requireAccess("users.manage");
  const [t, roles, staff] = await Promise.all([getT(), roleOptions(), staffForLogins()]);
  return (
    <>
      <PageHead back={{ href: "/settings/users", label: t.users.title }} title={t.users.new} />
      <UserForm
        t={{
          common: t.common,
          users: t.users,
          roleNames: t.roleNames,
          roleHelp: t.roleHelp,
          roles: t.roles,
        }}
        initial={{}}
        roles={roles}
        staff={staff}
      />
    </>
  );
}
