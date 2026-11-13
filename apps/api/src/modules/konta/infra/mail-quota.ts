import type { RateLimit } from "@lista/shared";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { mailQuota } from "../../../db/schema";

/**
 * Dobowe liczniki maili resetu (T-120, TH-10, N-03): okno od pierwszego maila, jak w
 * `SignInFailures`. Klucz to pseudonim e-maila albo nazwa budżetu łącznego, więc tabela nie
 * powiela adresów (TH-21).
 */
export class MailQuota {
  constructor(private readonly db: NodePgDatabase) {}

  /** Zalicza mail jednym atomowym zapytaniem; `false`, gdy limit klucza jest wyczerpany. */
  async take(key: string, { windowSeconds, max }: RateLimit): Promise<boolean> {
    const now = new Date();
    const windowExpired = sql`${mailQuota.windowStartedAt} <= ${new Date(now.getTime() - windowSeconds * 1000)}::timestamptz`;
    const [row] = await this.db
      .insert(mailQuota)
      .values({ key, count: 1, windowStartedAt: now })
      .onConflictDoUpdate({
        target: mailQuota.key,
        set: {
          count: sql`CASE WHEN ${windowExpired} THEN 1 ELSE ${mailQuota.count} + 1 END`,
          windowStartedAt: sql`CASE WHEN ${windowExpired} THEN ${now}::timestamptz ELSE ${mailQuota.windowStartedAt} END`,
        },
      })
      .returning({ count: mailQuota.count });
    return (row?.count ?? 0) <= max;
  }
}
