import type { Metadata } from "next";

import { LangSwitch } from "@/components/layout/LangSwitch";
import { getLang, getT } from "@/server/lang";
import { needsFirstAdmin } from "@/server/queries/users";

import { LoginForm } from "./LoginForm";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, t, lang, firstRun] = await Promise.all([
    searchParams,
    getT(),
    getLang(),
    needsFirstAdmin(),
  ]);
  return (
    <main className="grid min-h-dvh place-items-center bg-road px-4 py-10">
      <div className="w-full max-w-sm rounded-card bg-paper p-6 shadow-lift sm:p-8">
        <p className="text-[14px] font-semibold tracking-wide text-signal-ink uppercase">
          {t.app.office}
        </p>
        <h1 className="mt-1 mb-6 text-[28px] font-bold tracking-tight">
          {firstRun ? t.login.setupTitle : t.app.name}
        </h1>
        {firstRun ? (
          <SetupForm t={{ login: t.login, common: t.common }} />
        ) : (
          <LoginForm
            next={next ?? "/"}
            labels={{
              password: t.login.password,
              submit: t.login.submit,
              pending: t.common.saving,
              wrong: t.login.wrong,
              tooMany: t.login.tooMany,
              login: t.login.login,
            }}
          />
        )}
        <div className="mt-6">
          <LangSwitch lang={lang} label={t.common.language} />
        </div>
      </div>
    </main>
  );
}
