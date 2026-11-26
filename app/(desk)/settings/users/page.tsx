import type { Metadata } from "next";

import { Saved } from "@/components/domain/Saved";
import { ButtonLink } from "@/components/ui/Button";
import { PageHead } from "@/components/ui/PageHead";
import { Pill } from "@/components/ui/Pill";
import { Empty, RowLink, RowList } from "@/components/ui/Rows";
import { isSystemRole } from "@/lib/access";
import { formatDay, istDay } from "@/lib/dates";
import { requireAccess } from "@/server/auth";
import { getT } from "@/server/lang";
import { listUsers } from "@/server/queries/users";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  await requireAccess("users.manage");
  const [t, rows] = await Promise.all([getT(), listUsers()]);
  return (
    <>
      <Saved show={saved === "1"} label={t.common.saved} />
      <PageHead
        back={{ href: "/settings", label: t.settings.title }}
        title={t.users.title}
        sub={t.users.help}
        actions={
          <ButtonLink href="/settings/users/new" icon="plus">
            {t.users.new}
          </ButtonLink>
        }
      />
      {rows.length ? (
        <RowList className="max-w-2xl">
          {rows.map((u) => (
            <RowLink
              key={u.id}
              href={`/settings/users/${u.id}`}
              muted={!u.isActive}
              title={`${u.name} · ${u.login}`}
              meta={[
                u.roleKeys
                  .filter((k) => k !== null)
                  .map((k) => (isSystemRole(k) ? t.roleNames[k] : k))
                  .join(", "),
                u.staffName,
                `${t.users.lastLogin}: ${
                  u.lastLoginAt ? formatDay(istDay(u.lastLoginAt)) : t.users.never
                }`,
              ]
                .filter(Boolean)
                .join(" · ")}
              aside={u.isActive ? undefined : <Pill tone="neutral">{t.users.inactive}</Pill>}
            />
          ))}
        </RowList>
      ) : (
        <Empty>{t.common.nothing}</Empty>
      )}
    </>
  );
}
