import { IntentLink } from "@/components/ui/IntentLink";

/** A few links that work like tabs (period, view). Plain links, so they work without JS. */
export function Segmented({
  label,
  items,
}: {
  label: string;
  items: readonly { href: string; label: string; active: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto rounded-field bg-paper-deep p-1">
      {items.map((item) => (
        <IntentLink
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`flex min-h-11 flex-1 items-center justify-center rounded-[9px] px-3 text-[15px] font-semibold whitespace-nowrap transition-colors duration-150 ${item.active ? "bg-card text-ink shadow-card" : "text-ink-2 hover:text-ink"}`}
        >
          {item.label}
        </IntentLink>
      ))}
    </nav>
  );
}
