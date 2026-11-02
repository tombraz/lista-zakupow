import { sql } from "drizzle-orm";
import { listDailyActivity } from "../../../db/schema";
import { retentionRule, type RetentionRule } from "../../../db/retention";
import { activityDay } from "../domain/activity";

/** data-model.md: aktywność dzienna do miar sukcesu trzymana 90 dni. */
const KEPT_DAYS = 90;

export const activityRetention: RetentionRule[] = [
  retentionRule(
    listDailyActivity,
    "list_daily_activity",
    // Dzień w strefie aktywności (Europe/Warsaw), tak jak przy zapisie odhaczenia.
    (now) => sql`${listDailyActivity.day} < ${activityDay(now)}::date - ${KEPT_DAYS}::integer`,
  ),
];
