import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { listDailyActivity } from "../../../db/schema";

/** Jedno odhaczenie więcej w wierszu (lista, dzień, domownik); wiersz powstaje przy pierwszym. */
export async function incrementChecks(
  db: Pick<NodePgDatabase, "insert">,
  row: { listId: string; day: string; userId: string },
): Promise<void> {
  await db
    .insert(listDailyActivity)
    .values({ ...row, checks: 1 })
    .onConflictDoUpdate({
      target: [listDailyActivity.listId, listDailyActivity.day, listDailyActivity.userId],
      set: { checks: sql`${listDailyActivity.checks} + 1` },
    });
}
