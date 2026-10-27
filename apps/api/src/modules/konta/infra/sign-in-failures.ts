import { createHmac } from "node:crypto";
import { RATE_LIMITS } from "@lista/shared";
import { and, eq, gte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { signInFailure } from "../../../db/schema";

const { windowSeconds, max } = RATE_LIMITS.signInFailuresPerAccount;
const WINDOW_MS = windowSeconds * 1000;

/**
 * Licznik nieudanych logowań per konto (TH-09, ADR 0002) — uzupełnia limit per IP, który
 * nie zatrzyma prób z wielu adresów. Okno liczone od pierwszej porażki.
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

  async isBlocked(accountKey: string): Promise<boolean> {
    const windowStart = new Date(Date.now() - WINDOW_MS);
    const rows = await this.db
      .select({ failures: signInFailure.failures })
      .from(signInFailure)
      .where(
        and(
          eq(signInFailure.accountKey, accountKey),
          gte(signInFailure.windowStartedAt, windowStart),
        ),
      );
    return (rows[0]?.failures ?? 0) >= max;
  }

  async record(accountKey: string): Promise<void> {
    const now = new Date();
    const windowExpired = sql`${signInFailure.windowStartedAt} < ${new Date(now.getTime() - WINDOW_MS)}::timestamptz`;
    await this.db
      .insert(signInFailure)
      .values({ accountKey, failures: 1, windowStartedAt: now })
      .onConflictDoUpdate({
        target: signInFailure.accountKey,
        set: {
          failures: sql`CASE WHEN ${windowExpired} THEN 1 ELSE ${signInFailure.failures} + 1 END`,
          windowStartedAt: sql`CASE WHEN ${windowExpired} THEN ${now}::timestamptz ELSE ${signInFailure.windowStartedAt} END`,
        },
      });
  }
}
