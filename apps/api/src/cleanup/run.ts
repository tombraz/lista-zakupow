import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";
import type { Clock } from "../clock";
import { errorSummary } from "../logging";
import { cleanupRun } from "../db/schema";
import { purgeExpiredData } from "./purge";

/** data-model.md: sprzątanie raz na dobę. */
export const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Sprząta, jeśli od początku ostatniego sprzątania minęła doba; zwraca chwilę następnego.
 * Znacznik w bazie zajmowany jednym zapytaniem, więc dwa procesy API nie sprzątają naraz.
 */
export async function cleanUpIfDue(
  pool: Pool,
  clock: Clock,
  log: FastifyBaseLogger,
): Promise<Date> {
  const now = clock.now();
  const lastStart = await claimRun(pool, now);
  if (lastStart) return new Date(lastStart.getTime() + CLEANUP_INTERVAL_MS);
  const result = await purgeExpiredData(pool, now);
  for (const { table, error } of result.failed) {
    log.error({ event: "cleanup_failed", table, err: errorSummary(error) }, "cleanup failed");
  }
  log.info({ event: "cleanup", deleted: result.deleted }, "cleanup");
  return new Date(now.getTime() + CLEANUP_INTERVAL_MS);
}

/** `undefined`, gdy ten proces zajął sprzątanie; inaczej początek ostatniego (jeszcze w terminie). */
async function claimRun(pool: Pool, now: Date): Promise<Date | undefined> {
  const db = drizzle(pool);
  const due = new Date(now.getTime() - CLEANUP_INTERVAL_MS);
  const claimed = await db
    .insert(cleanupRun)
    .values({ startedAt: now })
    .onConflictDoUpdate({
      target: cleanupRun.id,
      set: { startedAt: now },
      setWhere: sql`${cleanupRun.startedAt} <= ${due}::timestamptz`,
    })
    .returning({ startedAt: cleanupRun.startedAt });
  if (claimed.length > 0) return undefined;
  const [last] = await db.select({ startedAt: cleanupRun.startedAt }).from(cleanupRun);
  return last?.startedAt ?? now;
}
