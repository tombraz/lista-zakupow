import { randomUUID } from "node:crypto";
import { RATE_LIMITS } from "@lista/shared";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { rateLimit } from "../../../db/schema";

const { windowSeconds, max } = RATE_LIMITS.passwordResetPerEmail;
const WINDOW_MS = windowSeconds * 1000;
// Osobna przestrzeń kluczy w tabeli limitów Better Auth (jego klucze to adres IP + ścieżka).
const KEY_PREFIX = "password-reset-email:";

/**
 * Limit próśb o reset per e-mail (TH-10): okno od pierwszej prośby, w wierszu `rate_limit`
 * (`last_request` = początek okna). Klucz to pseudonim e-maila, więc licznik działa tak samo dla
 * nieistniejącego konta (TH-11). Better Auth usuwa wiersze starsze niż jego najdłuższe okno
 * (1 h, rejestracja), czyli dopiero po wygaśnięciu tego okna (15 min).
 */
export class PasswordResetRequests {
  constructor(private readonly db: NodePgDatabase) {}

  /** Zalicza prośbę jednym atomowym zapytaniem; `false`, gdy limit e-maila jest wyczerpany. */
  async take(accountKey: string): Promise<boolean> {
    const now = Date.now();
    const windowExpired = sql`${rateLimit.lastRequest} <= ${now - WINDOW_MS}`;
    const [row] = await this.db
      .insert(rateLimit)
      .values({ id: randomUUID(), key: KEY_PREFIX + accountKey, count: 1, lastRequest: now })
      .onConflictDoUpdate({
        target: rateLimit.key,
        set: {
          count: sql`CASE WHEN ${windowExpired} THEN 1 ELSE ${rateLimit.count} + 1 END`,
          lastRequest: sql`CASE WHEN ${windowExpired} THEN ${now} ELSE ${rateLimit.lastRequest} END`,
        },
      })
      .returning({ count: rateLimit.count });
    return (row?.count ?? 0) <= max;
  }
}
