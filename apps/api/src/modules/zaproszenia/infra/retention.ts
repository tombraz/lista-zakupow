import { sql } from "drizzle-orm";
import { invitation } from "../../../db/schema";
import { retentionRule, type RetentionRule } from "../../../db/retention";

const DAY_MS = 24 * 60 * 60 * 1000;
/** data-model.md: link (także użyty i unieważniony) znika 30 dni po wygaśnięciu. */
const KEPT_AFTER_EXPIRY_DAYS = 30;

export const invitationRetention: RetentionRule[] = [
  retentionRule(
    invitation,
    "invitation",
    (now) =>
      sql`${invitation.expiresAt} < ${new Date(now.getTime() - KEPT_AFTER_EXPIRY_DAYS * DAY_MS)}::timestamptz`,
  ),
];
