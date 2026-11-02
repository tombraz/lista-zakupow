import type { Me } from "@lista/shared";
import { and, eq, like } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { user, verification } from "../../../db/schema";

/** F-16: nowe imię domownika; `null`, gdy konta już nie ma. */
export async function renameUser(
  db: NodePgDatabase,
  userId: string,
  name: string,
): Promise<Me | null> {
  const [row] = await db
    .update(user)
    .set({ name, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning({ id: user.id, name: user.name, email: user.email });
  return row ?? null;
}

/** Transakcja usunięcia konta widziana przez inne moduły (odczyt pod blokadą). */
export type AccountTransaction = Pick<NodePgDatabase, "select">;

/**
 * F-04, TH-18: konto znika w jednej transakcji; resztę robią kaskady i `SET NULL` schematu
 * (data-model.md). Wiersz domownika jest zablokowany od początku, więc `closing` (inne moduły:
 * kogo powiadomić po usunięciu) widzi stan, którego nic już nie zmieni. Tokeny resetu
 * (`verification`, wartość = id konta) idą razem z kontem. `null`, gdy konta już nie ma.
 */
export async function deleteAccount<T>(
  db: NodePgDatabase,
  userId: string,
  closing: (tx: AccountTransaction) => Promise<T>,
): Promise<T | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    if (!row) return null;
    const result = await closing(tx);
    await tx
      .delete(verification)
      .where(
        and(like(verification.identifier, "reset-password:%"), eq(verification.value, userId)),
      );
    await tx.delete(user).where(eq(user.id, userId));
    return result;
  });
}
