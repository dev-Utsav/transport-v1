import type { Strings } from "@/content/strings";
import type { FormState } from "@/lib/form";

/**
 * Announced banner at the top of a form when a save was refused: either fields to fix, or the
 * save itself failed (what was typed is kept, so pressing Save again is enough).
 */
export function FormError({ state, c }: { state: FormState; c: Strings["common"] }) {
  const message = state.failure
    ? c.saveFailed[state.failure]
    : Object.keys(state.errors).length > 0
      ? c.fixErrors
      : null;
  return (
    <div role="alert" aria-live="assertive">
      {message ? (
        <p className="rounded-field bg-due-soft px-4 py-3 text-[15px] font-semibold text-due">
          {message}
          {state.ref ? (
            <span className="mt-1 block font-mono text-[13px] font-normal">
              {c.errorRef} {state.ref}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
