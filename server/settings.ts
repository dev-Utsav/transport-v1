import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { getDb } from "@/server/db";
import { settings } from "@/server/db/schema";

export type Settings = typeof settings.$inferSelect;

/** The one settings row (created at start-up). Cached per request. */
export const getSettings = cache(async (): Promise<Settings> => {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  if (!row) throw new Error("Settings row missing");
  return row;
});
