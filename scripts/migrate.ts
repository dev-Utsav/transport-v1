// Applies drizzle/ migrations to DATABASE_URL (the live database). Local PGlite migrates itself on start.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Local development migrates the embedded database on its own.",
  );
  process.exit(1);
}
const client = postgres(url, { max: 1, prepare: false });
await migrate(drizzle({ client }), { migrationsFolder: "drizzle" });
await client.end();
console.warn("Migrations applied.");
