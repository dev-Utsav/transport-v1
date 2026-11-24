import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/forms/ChangePasswordForm";
import { PageHead } from "@/components/ui/PageHead";
import { getActor } from "@/server/auth";
import { getT } from "@/server/lang";

export const metadata: Metadata = { title: "Change password" };

/** Every signed-in person, including someone who must change a first password before anything else. */
export default async function ChangePasswordPage() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const t = await getT();
  return (
    <>
      <PageHead title={t.account.title} sub={t.account.help} />
      <ChangePasswordForm t={{ common: t.common, account: t.account, login: t.login }} />
    </>
  );
}
