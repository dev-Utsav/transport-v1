import { Icon } from "@/components/ui/Icon";

/** Confirmation after a redirect (?saved=1). Announced politely to screen readers. */
export function Saved({ show, label }: { show: boolean; label: string }) {
  return (
    <div role="status" aria-live="polite">
      {show ? (
        <p className="mb-5 flex items-center gap-2 rounded-field bg-in-soft px-4 py-3 text-[15px] font-semibold text-in">
          <Icon name="check" size={20} />
          {label}
        </p>
      ) : null}
    </div>
  );
}
