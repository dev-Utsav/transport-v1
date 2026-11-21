import "server-only";

import { sql } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";

/** sum() as a JS number, 0 when there are no rows. Paise totals fit well inside 2^53. */
export function sumInt(column: AnyColumn | SQL): SQL<number> {
  return sql<number>`coalesce(sum(${column}), 0)`.mapWith(Number);
}

export function countInt(): SQL<number> {
  return sql<number>`count(*)`.mapWith(Number);
}

/** A nullable joined aggregate as a number. */
export function orZero(value: SQL.Aliased<number> | AnyColumn): SQL<number> {
  return sql<number>`coalesce(${value}, 0)`.mapWith(Number);
}
