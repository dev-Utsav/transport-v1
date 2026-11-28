"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { setupFirstAdmin } from "@/server/actions/session";
import type { SetupState } from "@/server/actions/session";

const INPUT =
  "min-h-13 rounded-field bg-card px-4 text-[18px] ring-1 ring-rule-strong focus:ring-2 focus:ring-signal focus:outline-none";

/** First run only: the setup key (APP_PASSWORD) creates the first admin login. */
export function SetupForm({ t }: { t: Pick<Strings, "login" | "common"> }) {
  const [state, action] = useActionState<SetupState, FormData>(setupFirstAdmin, { error: null });
  const l = t.login;
  const message = state.failure
    ? t.common.saveFailed[state.failure]
    : state.error
      ? {
          key: l.errKey,
          login: l.errLogin,
          password: l.errPassword,
          mismatch: l.errMismatch,
          done: l.errDone,
          tooMany: l.tooMany,
        }[state.error]
      : null;
  const fields = [
    { name: "key", label: l.setupKey, type: "password", auto: "off" },
    { name: "name", label: l.yourName, type: "text", auto: "name" },
    { name: "login", label: l.login, type: "text", auto: "username" },
    { name: "password", label: l.newPassword, type: "password", auto: "new-password" },
    { name: "confirm", label: l.confirm, type: "password", auto: "new-password" },
  ] as const;
  return (
    <form action={action} className="grid gap-4" aria-describedby="setup-help">
      <p id="setup-help" className="text-[15px] text-ink-2">
        {l.setupHelp}
      </p>
      {fields.map((f) => (
        <div key={f.name} className="grid gap-1.5">
          <label htmlFor={`setup-${f.name}`} className="text-[15px] font-semibold">
            {f.label}
          </label>
          <input
            id={`setup-${f.name}`}
            name={f.name}
            type={f.type}
            autoComplete={f.auto}
            autoCapitalize="none"
            required
            minLength={f.name === "password" ? 8 : undefined}
            className={INPUT}
          />
        </div>
      ))}
      <p role="alert" className="min-h-5 text-[14px] font-semibold text-due">
        {message}
        {state.ref ? (
          <span className="mt-1 block font-mono text-[13px] font-normal">
            {t.common.errorRef} {state.ref}
          </span>
        ) : null}
      </p>
      <SubmitButton label={l.setupSubmit} pendingLabel={t.common.saving} className="w-full" />
    </form>
  );
}
