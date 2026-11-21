import "server-only";

import { z } from "zod";

/** Parsed once. In development a missing password means "no login" (shown in the header). */
const schema = z.object({
  APP_PASSWORD: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env = schema.parse(process.env);
