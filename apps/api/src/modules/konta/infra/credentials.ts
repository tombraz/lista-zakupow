import { withoutNul } from "@lista/shared";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { account, user } from "../../../db/schema";

/**
 * TH-10 (T-118): bieżący hash hasła konta z tym e-mailem albo `null`. Logowanie porównuje go
 * przed i po Better Auth: zmiana w międzyczasie znaczy, że zweryfikowano hasło sprzed resetu.
 * E-mail z NUL nie trafia do zapytania (22021 → 500, T-070): żadne konto takiego nie ma.
 */
export async function passwordHashOf(db: NodePgDatabase, email: string): Promise<string | null> {
  if (!withoutNul(email)) return null;
  const rows = await db
    .select({ password: account.password })
    .from(account)
    .innerJoin(user, eq(user.id, account.userId))
    .where(and(eq(user.email, email.toLowerCase()), eq(account.providerId, "credential")))
    .limit(1);
  return rows[0]?.password ?? null;
}
