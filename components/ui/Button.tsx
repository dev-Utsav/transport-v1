import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import type { IconName } from "@/components/ui/Icon";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-signal text-card hover:bg-signal-hover",
  secondary: "bg-card text-ink ring-1 ring-rule-strong hover:bg-paper",
  ghost: "text-ink hover:bg-paper-deep",
  danger: "bg-card text-due ring-1 ring-due/40 hover:bg-due-soft",
};

const BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-field px-5 text-[16px] font-semibold transition-colors duration-150 disabled:opacity-60";

export function buttonClass(variant: Variant = "primary", extra = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`;
}

type Common = { variant?: Variant; icon?: IconName; children: ReactNode; className?: string };

export function ButtonLink({
  href,
  variant,
  icon,
  children,
  className = "",
  ...rest
}: Common & Omit<ComponentProps<typeof Link>, "className" | "children">) {
  return (
    <Link href={href} className={buttonClass(variant, className)} {...rest}>
      {icon ? <Icon name={icon} size={20} /> : null}
      {children}
    </Link>
  );
}

export function Button({
  variant,
  icon,
  children,
  className = "",
  type = "button",
  ...rest
}: Common & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button type={type} className={buttonClass(variant, className)} {...rest}>
      {icon ? <Icon name={icon} size={20} /> : null}
      {children}
    </button>
  );
}

/** External link styled as a button (WhatsApp share, file downloads). */
export function ButtonAnchor({
  variant,
  icon,
  children,
  className = "",
  ...rest
}: Common & Omit<ComponentProps<"a">, "className" | "children">) {
  return (
    <a className={buttonClass(variant, className)} {...rest}>
      {icon ? <Icon name={icon} size={20} /> : null}
      {children}
    </a>
  );
}
