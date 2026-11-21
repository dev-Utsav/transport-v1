import { AppShell } from "@/components/layout/AppShell";
import { env } from "@/server/env";
import { getLang, getT } from "@/server/lang";
import { isPracticeRequest } from "@/server/practice-flag";
import { getSettings } from "@/server/settings";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const [t, lang, settings, isPractice] = await Promise.all([
    getT(),
    getLang(),
    getSettings(),
    isPracticeRequest(),
  ]);
  return (
    <AppShell
      t={t}
      lang={lang}
      businessName={settings.businessName}
      hasLogin={Boolean(env.APP_PASSWORD)}
      isPractice={isPractice}
    >
      {children}
    </AppShell>
  );
}
