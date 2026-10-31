import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { activityDay } from "./domain/activity";
import { incrementChecks } from "./infra/activity-repository";

/** Odhaczenie do miar sukcesu (BRD §10). */
export interface CheckActivity {
  listId: string;
  userId: string;
  at: Date;
}

/**
 * Publiczne API modułu: zapis odhaczenia w aktywności dziennej listy. Przyjmuje transakcję
 * wołającego, żeby aktywność zapisała się razem z odhaczeniem albo wcale (T-007).
 */
export function recordCheck(
  transaction: Pick<NodePgDatabase, "insert">,
  { listId, userId, at }: CheckActivity,
): Promise<void> {
  return incrementChecks(transaction, { listId, userId, day: activityDay(at) });
}
