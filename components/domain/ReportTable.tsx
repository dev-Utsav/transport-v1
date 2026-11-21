import type { ReactNode } from "react";

export type Column = { label: string; align?: "right" };

/** Ruled report table inside a card; scrolls sideways on phones instead of squashing. */
export function ReportTable({
  columns,
  rows,
  foot,
  wide = true,
}: {
  columns: readonly Column[];
  rows: readonly { key: string | number; cells: readonly ReactNode[] }[];
  foot?: readonly ReactNode[];
  /** wide tables keep a minimum width and scroll on phones; narrow ones just fit */
  wide?: boolean;
}) {
  const align = (c: Column | undefined) => (c?.align === "right" ? "text-right" : "text-left");
  return (
    <div className="overflow-x-auto rounded-card bg-card shadow-card ring-1 ring-rule">
      <table className={`w-full border-collapse text-[15px] ${wide ? "min-w-[560px]" : ""}`}>
        <thead>
          <tr className="border-b border-rule bg-paper/60 text-[13px] text-ink-2 uppercase">
            {columns.map((c) => (
              <th key={c.label} scope="col" className={`px-4 py-2.5 font-semibold ${align(c)}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {rows.map((r) => (
            <tr key={r.key}>
              {r.cells.map((cell, i) => (
                <td key={i} className={`px-4 py-2.5 ${align(columns[i])}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot ? (
          <tfoot>
            <tr className="border-t border-rule-strong bg-paper/60 font-bold">
              {foot.map((cell, i) => (
                <td key={i} className={`px-4 py-3 ${align(columns[i])}`}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
