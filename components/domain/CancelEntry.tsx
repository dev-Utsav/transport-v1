import type { Strings } from "@/content/strings";

/**
 * Cancelling is two deliberate taps: open, read what happens, confirm. <details> makes it work
 * without JS and keeps the button out of thumb's way. Nothing is deleted.
 */
export function CancelEntry({
  t,
  id,
  action,
}: {
  t: Strings;
  id: number;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <details className="group rounded-card ring-1 ring-rule" data-no-print>
      <summary className="cursor-pointer px-4 text-[15px] font-semibold text-due sm:px-5">
        {t.common.cancelRecord}
      </summary>
      <form action={action} className="grid gap-3 px-4 pb-4 sm:px-5">
        <input type="hidden" name="id" value={id} />
        <p className="text-[15px] text-ink-2">{t.common.cancelConfirm}</p>
        <button className="min-h-12 w-full rounded-field bg-due px-5 text-[16px] font-semibold text-card sm:w-auto">
          {t.common.cancelRecord}
        </button>
      </form>
    </details>
  );
}
