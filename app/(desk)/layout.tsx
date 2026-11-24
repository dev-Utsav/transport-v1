import { AppShell } from "@/components/layout/AppShell";
import { getActor } from "@/server/auth";
import { getLang, getT } from "@/server/lang";
import { isPracticeRequest } from "@/server/practice-flag";
import { getSettings } from "@/server/settings";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const [t, lang, settings, isPractice, actor] = await Promise.all([
    getT(),
    getLang(),
    getSettings(),
    isPracticeRequest(),
    getActor(),
  ]);
  return (
    <AppShell
      t={t}
      lang={lang}
      businessName={settings.businessName}
      permissions={actor?.permissions ?? new Set()}
      isPractice={isPractice}
    >
      {children}
    </AppShell>
  );
}
