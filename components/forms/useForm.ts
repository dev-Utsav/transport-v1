"use client";

import { useActionState } from "react";

import { EMPTY_FORM } from "@/lib/form";
import type { FormState } from "@/lib/form";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * useActionState plus two readers: `v(name)` gives what the admin typed (after a failed save)
 * or the starting value, `e(name)` the field's error. React resets the form after each submit,
 * so inputs use defaultValue={v(name)} and keep their text on errors.
 */
export function useForm(action: Action, initial: Record<string, string> = {}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM);
  const v = (name: string): string => state.values[name] ?? initial[name] ?? "";
  const e = (name: string) => state.errors[name];
  const hasErrors = Object.keys(state.errors).length > 0;
  return { state, formAction, pending, v, e, hasErrors };
}
