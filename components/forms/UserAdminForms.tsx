"use client";

import { useForm } from "@/components/forms/useForm";
import { Field, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { resetUserPassword, toggleUser } from "@/server/actions/users";

const BOX = "grid gap-4 rounded-card bg-card p-5 shadow-card ring-1 ring-rule";

/** Admin: give someone a new first password (they change it on next sign-in). */
export function ResetPasswordForm({ t, id }: { t: Pick<Strings, "common" | "users">; id: number }) {
  const { formAction, e } = useForm(resetUserPassword);
  return (
    <form action={formAction} className={BOX}>
      <input type="hidden" name="id" value={id} />
      <Field
        id="reset-password"
        label={t.users.tempPassword}
        hint={t.users.resetHelp}
        error={e("password")}
        c={t.common}
      >
        <TextInput
          id="reset-password"
          name="password"
          type="text"
          autoComplete="new-password"
          minLength={8}
          required
          invalid={Boolean(e("password"))}
        />
      </Field>
      <SubmitButton
        label={t.users.resetPassword}
        pendingLabel={t.common.saving}
        className="sm:justify-self-start"
      />
    </form>
  );
}

/** Admin: switch a login off or on. Refused for yourself and for the last active admin. */
export function ToggleUserForm({
  t,
  id,
  isActive,
}: {
  t: Pick<Strings, "common" | "users">;
  id: number;
  isActive: boolean;
}) {
  const { formAction, e } = useForm(toggleUser);
  const message = e("self") ? t.users.errSelf : e("lastAdmin") ? t.users.errLastAdmin : null;
  return (
    <form action={formAction} className="grid gap-2 border-t border-rule pt-6">
      <input type="hidden" name="id" value={id} />
      <button className="min-h-12 justify-self-start rounded-field px-4 text-[15px] font-semibold text-ink-2 ring-1 ring-rule-strong hover:bg-card">
        {isActive ? t.common.deactivate : t.common.activate}
      </button>
      <p role="alert" className="min-h-5 text-[14px] font-semibold text-due">
        {message}
      </p>
    </form>
  );
}
