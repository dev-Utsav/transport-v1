import "server-only";

import { z } from "zod";

/**
 * Parsed once.
 * - SESSION_SECRET signs login cookies (required in production; a fixed dev secret otherwise).
 * - APP_PASSWORD is only the one-time setup key for creating the first admin login.
 */
const schema = z.object({
  APP_PASSWORD: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env = schema.parse(process.env);
