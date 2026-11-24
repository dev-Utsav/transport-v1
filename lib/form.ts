import { z } from "zod";

import { parseRupees } from "@/lib/money";

/** What every form action returns when it doesn't redirect. */
export type FormState = {
  ok: boolean;
  /** field name → "required" | "invalid" */
  errors: Record<string, "required" | "invalid">;
  /** what the admin typed, so a failed save keeps their input */
  values: Record<string, string>;
  /** step of a multi-step form to reopen on error */
  step?: number;
  /** the save itself failed (not the input): "denied" = no permission, "busy" = try again */
  failure?: SaveFailure;
  /** short id printed in the server log next to the real error, to quote to support */
  ref?: string;
};

export const SAVE_FAILURES = ["denied", "busy", "taken", "server"] as const;
export type SaveFailure = (typeof SAVE_FAILURES)[number];

export const EMPTY_FORM: FormState = { ok: false, errors: {}, values: {} };

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

export function failed(
  error: z.ZodError,
  values: Record<string, string>,
  step?: number,
): FormState {
  const errors: FormState["errors"] = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!key || errors[key]) continue;
    const isEmpty = (values[key] ?? "").trim() === "";
    errors[key] = isEmpty || issue.message === "required" ? "required" : "invalid";
  }
  return { ok: false, errors, values, ...(step === undefined ? {} : { step }) };
}

/** Zod pieces shared by every form. Inputs arrive as strings from FormData. */
export const zf = {
  text: z.string().trim().min(1).max(200),
  optionalText: z.string().trim().max(500).default(""),
  id: z.coerce.number().int().positive(),
  optionalId: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .pipe(z.number().int().positive().nullable()),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  optionalDay: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
    ),
  count: z.coerce.number().int().min(0).max(100_000),
  /** Rupees as typed → paise. */
  money: z
    .string()
    .transform((v, ctx) => {
      const paise = parseRupees(v);
      if (paise === null) {
        ctx.addIssue({ code: "custom", message: "invalid" });
        return z.NEVER;
      }
      return paise;
    })
    .pipe(z.number().int().min(0).max(1_000_000_000)),
  positiveMoney: z
    .string()
    .transform((v, ctx) => {
      const paise = parseRupees(v);
      if (paise === null || paise === 0) {
        ctx.addIssue({ code: "custom", message: v.trim() ? "invalid" : "required" });
        return z.NEVER;
      }
      return paise;
    })
    .pipe(z.number().int().max(1_000_000_000)),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^[\d\s+\-()]*$/)
    .default(""),
};
