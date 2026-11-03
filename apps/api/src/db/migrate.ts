import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";
import { runDataMigrations } from "./data-migrations";
import { createPool, MIGRATION_CONNECTION_TIMEOUT_MS } from "./pool";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

export interface MigrationOptions {
  readonly log?: (message: string) => void;
}

/** Migracje SQL (drizzle-kit), potem kroki danych w TS (`data-migrations/`). */
export async function runMigrations(pool: Pool, options: MigrationOptions = {}): Promise<void> {
  await migrate(drizzle({ client: pool }), { migrationsFolder });
  await runDataMigrations(pool, options.log ?? (() => {}));
}

/** Migracje jako krok wdrożenia (`release_command`, `db:migrate`): własna pula, zamykana na końcu. */
export async function migrateDatabase(
  connectionString: string,
  options: MigrationOptions = {},
): Promise<void> {
  const pool = createPool(connectionString, {
    connectionTimeoutMillis: MIGRATION_CONNECTION_TIMEOUT_MS,
  });
  try {
    await runMigrations(pool, options);
  } finally {
    await pool.end();
  }
}
