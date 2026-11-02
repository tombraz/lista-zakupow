import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { accountRetention } from "../modules/konta";
import { activityRetention } from "../modules/statystyki";
import { invitationRetention } from "../modules/zaproszenia";

// Każdy moduł podaje terminy swoich tabel (inwentarz danych w data-model.md).
const RULES = [...accountRetention, ...invitationRetention, ...activityRetention];

export interface PurgeResult {
  /** Usunięte wiersze per tabela. */
  deleted: Record<string, number>;
  /** Tabele, których nie udało się sprzątnąć; reszta sprzątnięta mimo to (AC3). */
  failed: { table: string; error: unknown }[];
}

/** Usuwa dane po terminie z inwentarza (N-02); reszta danych zostaje. */
export async function purgeExpiredData(pool: Pool, now: Date): Promise<PurgeResult> {
  const db = drizzle(pool);
  const result: PurgeResult = { deleted: {}, failed: [] };
  for (const rule of RULES) {
    try {
      result.deleted[rule.table] = await rule.purge(db, now);
    } catch (error) {
      result.failed.push({ table: rule.table, error });
    }
  }
  return result;
}
