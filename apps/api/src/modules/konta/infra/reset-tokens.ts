import { and, eq, like } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { verification } from "../../../db/schema";

// Klucz tokenu resetu w tabeli `verification` Better Auth (`reset-password:<token>`).
const RESET_PREFIX = "reset-password:";

/**
 * F-03, TH-10: po zmianie hasła żaden inny link resetu konta nie działa. Better Auth zużywa tylko
 * użyty token, więc resztę usuwamy sami. Resety jednego konta idą po kolei (w pamięci procesu:
 * jedna instancja API, ADR 0003) — inaczej dwa różne linki zużyte naraz oba zmieniłyby hasło.
 */
export class ResetTokens {
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(private readonly db: NodePgDatabase) {}

  /** Wykonuje `run` po zakończeniu wcześniejszych resetów tego konta. */
  async exclusive<T>(userId: string, run: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(userId) ?? Promise.resolve();
    const current = previous.then(run, run);
    const tail = current.catch(() => undefined);
    this.queues.set(userId, tail);
    try {
      return await current;
    } finally {
      if (this.queues.get(userId) === tail) this.queues.delete(userId);
    }
  }

  /** Usuwa wszystkie tokeny resetu konta. */
  async revokeAll(userId: string): Promise<void> {
    await this.db
      .delete(verification)
      .where(
        and(like(verification.identifier, `${RESET_PREFIX}%`), eq(verification.value, userId)),
      );
  }
}
