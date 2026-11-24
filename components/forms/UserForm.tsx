"use client";

import { FormError } from "@/components/forms/FormError";
import { useForm } from "@/components/forms/useForm";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Strings } from "@/content/strings";
import { isSystemRole } from "@/lib/access";
import { saveUser } from "@/server/actions/users";

type Role = { id: number; key: string | null; name: string };

/** A login: who they are, what they type, which roles they hold, and (for drivers) whose trips. */
export function UserForm({
  t,
  initial,
  roles,
  staff,
}: {
  t: Pick<Strings, "common" | "users" | "roleNames" | "roleHelp" | "roles">;
  initial: Record<string, string>;
  roles: Role[];
  staff: { id: number; name: string; role: keyof Strings["roles"] }[];
}) {
  const { state, formAction, v, e } = useForm(saveUser, initial);
  const c = t.common;
  const held = new Set(v("roleIds").split(",").filter(Boolean));
  const roleError = e("roleIds") ?? e("roleIds-lastAdmin");
  const roleMessage = e("roleIds-lastAdmin") ? t.users.errLastAdmin : t.users.errRoles;
  // System roles are translated; roles an admin adds later show as named.
  const label = (r: Role) => (isSystemRole(r.key) ? t.roleNames[r.key] : r.name);
  const help = (r: Role) => (isSystemRole(r.key) ? t.roleHelp[r.key] : "");
  return (
    <form action={formAction} className="grid max-w-xl gap-5">
      <FormError state={state} c={c} />
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Field id="name" label={c.name} error={e("name")} c={c}>
        <TextInput id="name" name="name" defaultValue={v("name")} invalid={Boolean(e("name"))} />
      </Field>
      <Field id="login" label={t.users.login} hint={t.users.loginHelp} c={c}>
        <TextInput
          id="login"
          name="login"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={v("login")}
          invalid={Boolean(e("login"))}
          aria-describedby={e("login") ? "login-msg" : undefined}
        />
        {e("login") ? (
          <p id="login-msg" className="text-[14px] font-semibold text-due">
            {t.users.errLogin}
          </p>
        ) : null}
      </Field>
      {initial.id ? null : (
        <Field id="password" label={t.users.tempPassword} error={e("password")} c={c}>
          <TextInput
            id="password"
            name="password"
            type="text"
            autoComplete="new-password"
            minLength={8}
            defaultValue=""
            invalid={Boolean(e("password"))}
          />
        </Field>
      )}

      <fieldset
        className="grid min-w-0 gap-2"
        aria-describedby={roleError ? "roles-msg" : undefined}
      >
        <legend className="mb-1.5 text-[15px] font-semibold text-ink">{t.users.roles}</legend>
        {roles.map((r) => (
          <label
            key={r.id}
            className="flex min-h-12 cursor-pointer items-start gap-3 rounded-field bg-card px-4 py-3 ring-1 ring-rule-strong has-checked:bg-signal-soft has-checked:ring-2 has-checked:ring-signal"
          >
            <input
              type="checkbox"
              name="roleIds"
              value={r.id}
              defaultChecked={held.has(String(r.id))}
              className="mt-1 size-5 accent-signal"
            />
            <span className="grid">
              <span className="text-[16px] font-semibold">{label(r)}</span>
              {help(r) ? <span className="text-[14px] text-ink-2">{help(r)}</span> : null}
            </span>
          </label>
        ))}
        {roleError ? (
          <p id="roles-msg" role="alert" className="text-[14px] font-semibold text-due">
            {roleMessage}
          </p>
        ) : null}
      </fieldset>

      <Field id="staffId" label={t.users.staff} hint={t.users.staffHelp} c={c} optional>
        <SelectInput
          id="staffId"
          name="staffId"
          defaultValue={v("staffId")}
          invalid={Boolean(e("staffId"))}
          aria-describedby={e("staffId") ? "staff-msg" : "staffId-hint"}
        >
          <option value="">{t.users.noStaff}</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {t.roles[s.role]}
            </option>
          ))}
        </SelectInput>
        {e("staffId") ? (
          <p id="staff-msg" role="alert" className="text-[14px] font-semibold text-due">
            {t.users.errDriverStaff}
          </p>
        ) : null}
      </Field>
      <Field id="phone" label={c.phone} error={e("phone")} c={c} optional>
        <TextInput id="phone" name="phone" type="tel" defaultValue={v("phone")} />
      </Field>
      <SubmitButton label={c.save} pendingLabel={c.saving} className="w-full sm:w-auto" />
    </form>
  );
}
