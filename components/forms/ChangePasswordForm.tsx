"use client";

import { useActionState } from "react";

import { Field, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { changePassword } from "@/server/actions/session";
import type { PasswordState } from "@/server/actions/session";

export function ChangePasswordForm({ t }: { t: Pick<Strings, "common" | "account" | "login"> }) {
  const [state, action] = useActionState<PasswordState, FormData>(changePassword, {
    error: null,
  });
  const message =
    state.error === "wrong"
      ? t.account.wrong
      : state.error === "mismatch"
        ? t.login.errMismatch
        : state.error === "password"
          ? t.account.password
          : null;
  return (
    <form action={action} className="grid max-w-md gap-5">
      <Field id="current" label={t.account.current} c={t.common}>
        <TextInput
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          invalid={state.error === "wrong"}
        />
      </Field>
      <Field id="password" label={t.login.newPassword} c={t.common}>
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          invalid={state.error === "password"}
        />
      </Field>
      <Field id="confirm" label={t.login.confirm} c={t.common}>
        <TextInput
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          invalid={state.error === "mismatch"}
        />
      </Field>
      <p role="alert" className="min-h-5 text-[14px] font-semibold text-due">
        {message}
      </p>
      <SubmitButton
        label={t.account.submit}
        pendingLabel={t.common.saving}
        className="w-full sm:w-auto"
      />
    </form>
  );
}
