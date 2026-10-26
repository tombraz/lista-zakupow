import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { createPool } from "../src/db/pool";
import { databaseUrl, TEMPLATE_DATABASE } from "./database-constants";

export interface TestDatabase {
  readonly pool: Pool;
}

/**
 * Każdy plik testów dostaje własną bazę sklonowaną z szablonu (z wykonanymi migracjami),
 * a przed każdym testem czyste tabele (testing-strategy.md, „Dane testowe”).
 */
export function useTestDatabase(): TestDatabase {
  const adminUrl = inject("postgresAdminUrl");
  const name = `test_${randomUUID().replaceAll("-", "")}`;
  let pool: Pool | undefined;

  beforeAll(async () => {
    const admin = createPool(adminUrl);
    await admin.query(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE_DATABASE}`);
    await admin.end();
    pool = createPool(databaseUrl(adminUrl, name));
  });

  beforeEach(async () => {
    await truncateAllTables(pool);
  });

  afterAll(async () => {
    await pool?.end();
    const admin = createPool(adminUrl);
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  });

  return {
    get pool() {
      if (!pool) throw new Error("useTestDatabase: pool is available only inside tests");
      return pool;
    },
  };
}

// Wszystkie tabele w schemacie public; tabela migracji leży w schemacie drizzle i zostaje.
async function truncateAllTables(pool: Pool | undefined): Promise<void> {
  if (!pool) return;
  const { rows } = await pool.query<{ name: string }>(
    "SELECT format('%I.%I', schemaname, tablename) AS name FROM pg_tables WHERE schemaname = 'public'",
  );
  if (rows.length === 0) return;
  await pool.query(`TRUNCATE ${rows.map((row) => row.name).join(", ")} RESTART IDENTITY CASCADE`);
}
