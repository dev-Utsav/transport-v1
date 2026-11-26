"use client";

import { SIDEBAR_COOKIE, SIDEBAR_INPUT_ID } from "@/components/layout/nav";
import { Icon } from "@/components/ui/Icon";

/**
 * Collapse / open the desktop sidebar. The state is a checkbox that the shell reads with CSS
 * `:has()`, so it works before JS loads; JS only remembers the choice in a cookie, which the
 * server reads to render the same state next time (no flash).
 */
export function SidebarToggle({
  collapsed,
  label,
}: {
  collapsed: boolean;
  label: string;
}) {
  function remember(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.checked ? "collapsed" : "open";
    document.cookie = `${SIDEBAR_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <>
      <input
        type="checkbox"
        id={SIDEBAR_INPUT_ID}
        defaultChecked={collapsed}
        onChange={remember}
        className="peer sr-only"
      />
      <label
        htmlFor={SIDEBAR_INPUT_ID}
        title={label}
        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-field px-3 text-[15px] font-semibold whitespace-nowrap text-ink-2 transition-colors duration-150 peer-focus-visible:outline-3 peer-focus-visible:outline-signal hover:bg-paper-deep hover:text-ink"
      >
        <Icon name="panel" size={20} className="shrink-0" />
        <span>{label}</span>
      </label>
    </>
  );
}
