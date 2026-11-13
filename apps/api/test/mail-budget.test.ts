import { RATE_LIMITS } from "@lista/shared";
import { describe, expect, it } from "vitest";
import { OWNER_ALERT_WINDOW_SECONDS } from "../src/owner-alerts";

// deployment.md: darmowy plan Brevo — 300 maili na dobę kalendarzową.
const BREVO_DAILY_MAILS = 300;
const DAY_SECONDS = 24 * 60 * 60;

// Prewencja T-120: najgorszy przypadek wszystkich maili z API mieści się w dobie Brevo.
// Nowy rodzaj maila albo alarmu musi tu dopisać swój najgorszy przypadek.
describe("daily mail budget (T-120, N-03)", () => {
  it("keeps reset mails and owner alerts within the provider's daily quota", () => {
    const { max, windowSeconds } = RATE_LIMITS.passwordResetMailsDaily;
    // Okno liczone od pierwszego maila, więc doba kalendarzowa przecina najwyżej dwa okna.
    const budgetWindows = Math.ceil(DAY_SECONDS / windowSeconds) + 1;
    const resetMails = budgetWindows * max;
    // `reset_tokens_revoke_failed` (T-088): najwyżej jeden alarm na okno tłumienia.
    const revokeAlerts = DAY_SECONDS / OWNER_ALERT_WINDOW_SECONDS;
    // `password_reset_budget_exhausted`: jeden alarm na okno budżetu.
    const budgetAlerts = budgetWindows;

    expect(resetMails + revokeAlerts + budgetAlerts).toBeLessThanOrEqual(BREVO_DAILY_MAILS);
  });
});
