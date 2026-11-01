import type { Pool } from "pg";
import { nameKeyNfkc } from "./0007-name-key-nfkc";
import type { DataMigration } from "./data-migration";

/** Kolejność wykonania; nowy krok na koniec, nigdy zmiana kroku już wdrożonego. */
const DATA_MIGRATIONS: readonly DataMigration[] = [nameKeyNfkc];

/**
 * Każdy krok raz: wiersz `data_migration` wstawiony w tej samej transakcji co zmiana danych.
 * Drugi równoległy proces czeka na ten wiersz (klucz główny) i po zatwierdzeniu pomija krok.
 */
export async function runDataMigrations(pool: Pool, log: (message: string) => void): Promise<void> {
  for (const step of DATA_MIGRATIONS) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const claimed = await client.query(
        "INSERT INTO data_migration (name) VALUES ($1) ON CONFLICT DO NOTHING",
        [step.name],
      );
      if (claimed.rowCount === 1) {
        const summary = await step.run(client);
        await client.query("COMMIT");
        log(`data migration ${step.name}: ${summary}`);
      } else {
        await client.query("ROLLBACK");
      }
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
