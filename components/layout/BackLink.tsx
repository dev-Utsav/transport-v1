"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { previousScreen } from "@/components/layout/trail";
import { Icon } from "@/components/ui/Icon";

const noSubscribe = () => () => {};

/**
 * "← Back". Goes to the screen the person came from in this tab, named by its heading; before
 * JS loads, or on a fresh tab, it is a plain link to the section the page belongs to.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const previous = useSyncExternalStore(
    noSubscribe,
    () => previousScreen(pathname)?.title ?? null,
    () => null,
  );
  return (
    <Link
      href={href}
      onClick={(event) => {
        if (previous === null) return;
        event.preventDefault();
        router.back();
      }}
      className="-ml-1 inline-flex w-fit max-w-full items-center gap-1 rounded-md px-1 py-1 text-[15px] font-semibold text-ink-2 hover:text-ink"
      data-no-print
    >
      <Icon name="chevronLeft" size={18} className="shrink-0" />
      <span className="truncate">{previous || label}</span>
    </Link>
  );
}
