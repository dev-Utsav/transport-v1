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
// No top-level await: package.json has no "type": "module", so tsx runs this as CommonJS.
async function main(dbUrl: string): Promise<void> {
  const client = postgres(dbUrl, { max: 1, prepare: false });
  try {
    await migrate(drizzle({ client }), { migrationsFolder: "drizzle" });
    console.warn("Migrations applied.");
  } finally {
    await client.end();
  }
}

main(url).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
