import { ButtonAnchor } from "@/components/ui/Button";
import type { Strings } from "@/content/strings";
import { fill } from "@/content/strings";
import { formatMoney } from "@/lib/money";
import { waLink } from "@/lib/whatsapp";

/** Opens WhatsApp with a polite reminder already typed. */
export function RemindButton({
  t,
  name,
  phone,
  balance,
  compact,
}: {
  t: Strings;
  name: string;
  phone: string;
  balance: number;
  compact?: boolean;
}) {
  const text = fill(t.vendors.remindText, { name, amount: formatMoney(balance) });
  return (
    <ButtonAnchor
      href={waLink(phone, text)}
      target="_blank"
      rel="noopener noreferrer"
      variant="secondary"
      icon="bell"
      className={compact ? "min-h-11 px-3 text-[14px]" : ""}
    >
      {compact ? (
        <span className="sr-only sm:not-sr-only">{t.vendors.remind}</span>
      ) : (
        t.vendors.remind
      )}
    </ButtonAnchor>
  );
}
