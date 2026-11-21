import { Icon } from "@/components/ui/Icon";

/** GET form: the search lands in the URL, works without JS, and back/forward keep it. */
export function SearchBar({
  action,
  name = "q",
  defaultValue = "",
  placeholder,
  label,
  children,
}: {
  action: string;
  name?: string;
  defaultValue?: string;
  placeholder: string;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <form action={action} role="search" className="flex gap-2" data-no-print>
      <label className="relative flex-1">
        <span className="sr-only">{label}</span>
        <Icon
          name="search"
          size={20}
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-2"
        />
        <input
          type="search"
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          enterKeyHint="search"
          className="block min-h-13 w-full rounded-field bg-card pr-4 pl-12 text-[17px] shadow-card ring-1 ring-rule-strong placeholder:text-ink-3 focus:ring-2 focus:ring-signal focus:outline-none"
        />
      </label>
      {children}
    </form>
  );
}
