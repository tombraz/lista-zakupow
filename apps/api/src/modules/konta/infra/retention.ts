import { RATE_LIMITS } from "@lista/shared";
import { sql } from "drizzle-orm";
import { mailQuota, rateLimit, session, signInFailure, verification } from "../../../db/schema";
import { retentionRule, type RetentionRule } from "../../../db/retention";

const SECOND_MS = 1000;

// Limity trzymane w `rate_limit` (Better Auth i limit resetu per e-mail). Wiersz nie zapisuje
// swojego okna, więc wygasa po najdłuższym z nich — jak w czyszczeniu samego Better Auth.
const RATE_LIMIT_ROW_MS =
  Math.max(
    RATE_LIMITS.signInPerIp.windowSeconds,
    RATE_LIMITS.signUpPerIp.windowSeconds,
    RATE_LIMITS.passwordResetPerIp.windowSeconds,
    RATE_LIMITS.passwordResetPerEmail.windowSeconds,
  ) * SECOND_MS;
const SIGN_IN_FAILURE_WINDOW_MS = RATE_LIMITS.signInFailuresPerAccount.windowSeconds * SECOND_MS;
// T-120: dobowe liczniki maili resetu (per e-mail i łączny) wygasają po dłuższym oknie.
const MAIL_QUOTA_WINDOW_MS =
  Math.max(
    RATE_LIMITS.passwordResetPerEmailDaily.windowSeconds,
    RATE_LIMITS.passwordResetMailsDaily.windowSeconds,
  ) * SECOND_MS;

const ago = (now: Date, ms: number) => new Date(now.getTime() - ms);

/** Sesje, tokeny resetu i liczniki limitów do wygaśnięcia (data-model.md, TH-27). */
export const accountRetention: RetentionRule[] = [
  retentionRule(session, "session", (now) => sql`${session.expiresAt} < ${now}::timestamptz`),
  retentionRule(
    verification,
    "verification",
    (now) => sql`${verification.expiresAt} < ${now}::timestamptz`,
  ),
  retentionRule(
    rateLimit,
    "rate_limit",
    (now) => sql`${rateLimit.lastRequest} < ${now.getTime() - RATE_LIMIT_ROW_MS}`,
  ),
  retentionRule(
    signInFailure,
    "sign_in_failure",
    (now) =>
      sql`${signInFailure.windowStartedAt} < ${ago(now, SIGN_IN_FAILURE_WINDOW_MS)}::timestamptz`,
  ),
  retentionRule(
    mailQuota,
    "mail_quota",
    (now) => sql`${mailQuota.windowStartedAt} < ${ago(now, MAIL_QUOTA_WINDOW_MS)}::timestamptz`,
  ),
];
