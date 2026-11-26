/**
 * Decides what a migration run may do, before it touches anything. Pure, so it is unit tested.
 *
 * Drizzle applies every migration whose journal time (`folderMillis`) is newer than the last row
 * in `drizzle.__drizzle_migrations`, so re-running is already a no-op. What it does not catch,
 * and this does:
 * - an applied migration whose file was edited afterwards (CLAUDE.md: never edit an applied one);
 * - a database that has migrations this code doesn't know (deploying an older commit);
 * - a new migration dated before the last applied one, which Drizzle would silently skip.
 */

/**
 * `hashes`: the sha256 Drizzle would store for this file, once per line ending (LF, CRLF). Older
 * rows were written from Windows checkouts (CRLF) and others from LF ones, so a file only counts as
 * edited when its text differs, not its line endings.
 */
export type MigrationFile = { tag: string; folderMillis: number; hashes: string[] };
export type AppliedRow = { hash: string; createdAt: number };

export type MigrationPlan =
  { ok: true; pending: MigrationFile[] } | { ok: false; problems: string[] };

export function planMigrations(files: MigrationFile[], applied: AppliedRow[]): MigrationPlan {
  const problems: string[] = [];
  const byTime = new Map(files.map((f) => [f.folderMillis, f]));
  const last = applied.reduce((max, row) => Math.max(max, row.createdAt), 0);

  for (const row of applied) {
    const file = byTime.get(row.createdAt);
    if (!file) {
      problems.push(
        `The database has a migration (created_at ${row.createdAt}) that this code doesn't have. Deploy the newer code instead.`,
      );
    } else if (!file.hashes.includes(row.hash)) {
      problems.push(
        `${file.tag} was edited after it was applied. Restore the file and add a new migration instead.`,
      );
    }
  }

  const appliedTimes = new Set(applied.map((r) => r.createdAt));
  const pending = files.filter((f) => !appliedTimes.has(f.folderMillis));
  for (const f of pending) {
    if (f.folderMillis <= last) {
      problems.push(
        `${f.tag} is dated before the last applied migration, so it would never run. Regenerate it with pnpm db:generate.`,
      );
    }
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, pending };
}
