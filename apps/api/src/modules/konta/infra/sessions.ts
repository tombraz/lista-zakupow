import { and, eq, gt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { session } from "../../../db/schema";

/**
 * TH-28: sesja nadal istnieje i nie wygasła. Połączenie na żywo żyje dłużej niż żądanie, które
 * sprawdziło ciasteczko, a sesja kończy się też bez wylogowania (wygaśnięcie, usunięcie wiersza).
 * Czas jak w Better Auth (`Date`).
 */
export async function isSessionActive(
  db: NodePgDatabase,
  sessionId: string,
  now: Date,
): Promise<boolean> {
  const rows = await db
    .select({ id: session.id })
    .from(session)
    .where(and(eq(session.id, sessionId), gt(session.expiresAt, now)))
    .limit(1);
  return rows.length > 0;
}
