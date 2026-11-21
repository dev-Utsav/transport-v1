"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { login } from "@/server/actions/session";
import type { LoginState } from "@/server/actions/session";

export function LoginForm({
  next,
  labels,
}: {
  next: string;
  labels: { password: string; submit: string; pending: string; wrong: string; tooMany: string };
}) {
  const [state, action] = useActionState<LoginState, FormData>(login, { error: null });
  const error =
    state.error === "wrong" ? labels.wrong : state.error === "tooMany" ? labels.tooMany : null;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-1.5">
        <label htmlFor="password" className="text-[15px] font-semibold">
          {labels.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "password-error" : undefined}
          className="min-h-13 rounded-field bg-card px-4 text-[18px] ring-1 ring-rule-strong focus:ring-2 focus:ring-signal focus:outline-none"
        />
        <p id="password-error" role="alert" className="min-h-5 text-[14px] font-semibold text-due">
          {error}
        </p>
      </div>
      <SubmitButton label={labels.submit} pendingLabel={labels.pending} className="w-full" />
    </form>
  );
}
