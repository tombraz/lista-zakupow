import { createHmac } from "node:crypto";
import { RATE_LIMITS } from "@lista/shared";
import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { signInFailure } from "../../../db/schema";

const { windowSeconds, max } = RATE_LIMITS.signInFailuresPerAccount;
const WINDOW_MS = windowSeconds * 1000;

/**
 * Licznik nieudanych logowań per konto (TH-09, ADR 0002) — uzupełnia limit per IP, który
 * nie zatrzyma prób z wielu adresów. Okno liczone od pierwszej porażki.
 *
 * Próba jest rezerwowana jednym atomowym zapytaniem przed sprawdzeniem hasła, więc
 * równoległe żądania nie przejdą obok limitu; próba, która nie okazała się porażką, wraca.
 */
export class SignInFailures {
  constructor(
    private readonly db: NodePgDatabase,
    private readonly secret: string,
  ) {}

  /** Pseudonim konta do licznika i logu `security` (bez e-maila, TH-21). */
  accountKey(email: string): string {
    const normalized = email.trim().toLowerCase();
    return createHmac("sha256", this.secret).update(normalized).digest("base64url");
  }

  /** Zalicza próbę z góry; `false`, gdy limit konta jest już wyczerpany. */
  async reserve(accountKey: string): Promise<boolean> {
    const now = new Date();
    const windowExpired = sql`${signInFailure.windowStartedAt} < ${new Date(now.getTime() - WINDOW_MS)}::timestamptz`;
    const [row] = await this.db
      .insert(signInFailure)
      .values({ accountKey, failures: 1, windowStartedAt: now })
      .onConflictDoUpdate({
        target: signInFailure.accountKey,
        set: {
          failures: sql`CASE WHEN ${windowExpired} THEN 1 ELSE ${signInFailure.failures} + 1 END`,
          windowStartedAt: sql`CASE WHEN ${windowExpired} THEN ${now}::timestamptz ELSE ${signInFailure.windowStartedAt} END`,
        },
      })
      .returning({ failures: signInFailure.failures });
    return (row?.failures ?? 0) <= max;
  }

  /**
   * Oddaje zarezerwowaną próbę, która nie była porażką (np. poprawne hasło). Licznik na zerze
   * znika, żeby tabela trzymała tylko konta z porażkami (TH-27). Równoległa rezerwacja między
   * zapytaniami podnosi licznik ponad zero, więc `DELETE` jej wiersza nie usunie.
   */
  async release(accountKey: string): Promise<void> {
    const account = eq(signInFailure.accountKey, accountKey);
    await this.db
      .update(signInFailure)
      .set({ failures: sql`GREATEST(${signInFailure.failures} - 1, 0)` })
      .where(account);
    await this.db.delete(signInFailure).where(and(account, eq(signInFailure.failures, 0)));
  }
}
