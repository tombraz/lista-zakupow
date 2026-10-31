import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { createPool } from "../src/db/pool";
import { databaseUrl, TEMPLATE_DATABASE } from "./database-constants";

// Produkcyjne 3 s chronią żądanie przed martwą bazą; w testach połączenie z kontenerem przy
// obciążonej maszynie bywa wolniejsze i kończyło się „Connection terminated due to connection
// timeout” (T-021). Limit testu (30 s) nadal przerywa test, jeśli baza naprawdę nie odpowiada.
const TEST_CONNECTION_TIMEOUT_MS = 20_000;

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
    pool = createPool(databaseUrl(adminUrl, name), {
      connectionTimeoutMillis: TEST_CONNECTION_TIMEOUT_MS,
    });
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
// DELETE, nie TRUNCATE: test zostawia kilka wierszy, a TRUNCATE tworzy nowe pliki każdej tabeli
// i indeksu (~0,4 s na test, pod obciążeniem do 3 s; T-021). Rola `replica` wyłącza wyzwalacze
// kluczy obcych, więc kolejność tabel nie ma znaczenia. Schemat nie ma sekwencji do restartu.
async function truncateAllTables(pool: Pool | undefined): Promise<void> {
  if (!pool) return;
  const { rows } = await pool.query<{ name: string }>(
    "SELECT format('%I.%I', schemaname, tablename) AS name FROM pg_tables WHERE schemaname = 'public'",
  );
  if (rows.length === 0) return;
  const deletes = rows.map((row) => `DELETE FROM ${row.name};`).join(" ");
  await pool.query(`BEGIN; SET LOCAL session_replication_role = replica; ${deletes} COMMIT;`);
}
