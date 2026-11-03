import { sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgTable } from "drizzle-orm/pg-core";

/** Wiersze usuwane jednym zapytaniem: krótkie blokady, sprzątanie nie wstrzymuje żądań (T-064). */
export const PURGE_BATCH_ROWS = 1000;

/** Termin przechowywania jednej tabeli z inwentarza danych (data-model.md); podaje go moduł tabeli. */
export interface RetentionRule {
  table: string;
  /** Usuwa wiersze po terminie liczonym od `now`; zwraca ich liczbę. */
  purge(db: NodePgDatabase, now: Date): Promise<number>;
}

/** Reguła usuwająca partiami wiersze tabeli, które spełniają `expired(now)`. */
export function retentionRule(
  table: PgTable,
  name: string,
  expired: (now: Date) => SQL,
): RetentionRule {
  return { table: name, purge: (db, now) => deleteInBatches(db, table, expired(now)) };
}

async function deleteInBatches(db: NodePgDatabase, table: PgTable, expired: SQL): Promise<number> {
  let deleted = 0;
  for (;;) {
    // Warunek powtórzony poza podzapytaniem: wiersz zmieniony w międzyczasie (np. odnowiona
    // sesja) jest sprawdzany ponownie, zanim zniknie.
    const result = await db.execute(
      sql`DELETE FROM ${table} WHERE ctid = ANY (ARRAY(SELECT ctid FROM ${table} WHERE ${expired} LIMIT ${PURGE_BATCH_ROWS})) AND ${expired}`,
    );
    const rows = result.rowCount ?? 0;
    deleted += rows;
    if (rows < PURGE_BATCH_ROWS) return deleted;
  }
}
