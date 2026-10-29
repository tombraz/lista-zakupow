import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";
import { createPool, MIGRATION_CONNECTION_TIMEOUT_MS } from "./pool";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

export async function runMigrations(pool: Pool): Promise<void> {
  await migrate(drizzle({ client: pool }), { migrationsFolder });
}

/** Migracje jako krok wdrożenia (`release_command`, `db:migrate`): własna pula, zamykana na końcu. */
export async function migrateDatabase(connectionString: string): Promise<void> {
  const pool = createPool(connectionString, {
    connectionTimeoutMillis: MIGRATION_CONNECTION_TIMEOUT_MS,
  });
  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}
