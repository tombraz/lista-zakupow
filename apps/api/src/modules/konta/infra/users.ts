import type { Me } from "@lista/shared";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { user } from "../../../db/schema";

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
