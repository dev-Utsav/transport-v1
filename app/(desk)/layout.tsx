import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/AppShell";
import { SIDEBAR_COOKIE } from "@/components/layout/nav";
import { getActor } from "@/server/auth";
import { getLang, getT } from "@/server/lang";
import { isPracticeRequest } from "@/server/practice-flag";
import { getSettings } from "@/server/settings";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const [t, lang, settings, isPractice, actor, jar] = await Promise.all([
    getT(),
    getLang(),
    getSettings(),
    isPracticeRequest(),
    getActor(),
    cookies(),
  ]);
  return (
    <AppShell
      t={t}
      lang={lang}
      businessName={settings.businessName}
      permissions={actor?.permissions ?? new Set()}
      isPractice={isPractice}
      sidebarCollapsed={jar.get(SIDEBAR_COOKIE)?.value === "collapsed"}
    >
      {children}
    </AppShell>
  );
}
