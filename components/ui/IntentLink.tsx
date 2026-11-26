"use client";

import Link from "next/link";
import { useState } from "react";
import type { ComponentProps } from "react";

import { LinkPending } from "@/components/ui/LinkPending";

type Props = ComponentProps<typeof Link>;

/**
 * `next/link` that prefetches only when the person shows intent (hover, touch, focus).
 * Every desk page is dynamic, so Next's default (prefetch each link in view) fires a database-backed
 * server render per link and floods the server and the small connection pool; a real click then
 * queues behind them. `prefetch={false}` until intent, then Next's default (`null`).
 */
export function IntentLink({ onMouseEnter, onTouchStart, onFocus, prefetch, children, ...rest }: Props) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...rest}
      prefetch={prefetch ?? (intent ? null : false)}
      onMouseEnter={(e) => {
        setIntent(true);
        onMouseEnter?.(e);
      }}
      onTouchStart={(e) => {
        setIntent(true);
        onTouchStart?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
    >
      {children}
      <LinkPending />
    </Link>
  );
}
