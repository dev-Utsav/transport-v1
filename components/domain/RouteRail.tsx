import type { TripStatus } from "@/lib/types";

const POSITION: Record<TripStatus, number> = {
  loading: 0,
  in_transit: 50,
  arrived: 100,
  closed: 100,
};

/**
 * Kadodara ●━━━━🚚─ ─ ─ ○ Delhi. The truck sits where the trip is: at the start while loading,
 * on the road in transit, at the end once it arrives. Pure SVG + CSS, no JS.
 */
export function RouteRail({
  from,
  to,
  status,
  tone = "light",
}: {
  from: string;
  to: string;
  status: TripStatus;
  tone?: "light" | "dark";
}) {
  const at = POSITION[status];
  const isDark = tone === "dark";
  const done = isDark ? "bg-road-signal" : "bg-signal";
  const rest = isDark ? "border-road-muted" : "border-rule-strong";
  const label = isDark ? "text-road-text" : "text-ink";
  return (
    <div className="grid gap-1.5" aria-label={`${from} → ${to}`} role="img">
      <div className="relative mx-2 h-6">
        <div className={`absolute top-1/2 right-0 left-0 border-t-2 border-dashed ${rest}`} />
        <div
          className={`absolute top-1/2 left-0 h-[3px] -translate-y-[0.5px] rounded-full ${done}`}
          style={{ width: `${at}%` }}
        />
        <span
          className={`absolute top-1/2 left-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${done}`}
        />
        <span
          className={`absolute top-1/2 right-0 size-3 translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${at === 100 ? `${done} border-transparent` : `${rest} ${isDark ? "bg-road" : "bg-card"}`}`}
        />
        <span
          className={`absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${isDark ? "bg-road-text text-road" : "bg-road text-road-text"}`}
          style={{ left: `${at}%` }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M2 6h11v10H2zM13 9h4.5L21 12.5V16h-8z" />
          </svg>
        </span>
      </div>
      <div className={`flex justify-between gap-3 text-[14px] font-semibold ${label}`}>
        <span className="truncate">{from}</span>
        <span className="truncate text-right">{to}</span>
      </div>
    </div>
  );
}
