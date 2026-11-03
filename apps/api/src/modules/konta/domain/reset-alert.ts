import { PASSWORD_RESET_VALIDITY_SECONDS } from "@lista/shared";
import type { OwnerAlert } from "../../../owner-alerts";

/**
 * T-088 (N-03, F-03, TH-10): po udanym resecie pozostałe linki konta nie zostały unieważnione,
 * więc mogą działać do wygaśnięcia. Tylko identyfikator konta i kod błędu — bez e-maila, tokenów
 * i komunikatu bazy (TH-21).
 */
export function linksNotRevokedAlert(userId: string, at: Date, errorCode: string): OwnerAlert {
  const until = new Date(at.getTime() + PASSWORD_RESET_VALIDITY_SECONDS * 1000);
  return {
    event: "reset_tokens_revoke_failed",
    at,
    subject: "Alarm: linki resetu hasła nie zostały unieważnione",
    text: [
      "Po udanej zmianie hasła nie udało się unieważnić pozostałych linków resetu tego konta.",
      "",
      "Zdarzenie: reset_tokens_revoke_failed",
      `Konto (userId): ${userId}`,
      `Czas zdarzenia (UTC): ${at.toISOString()}`,
      `Pozostałe linki mogą działać najpóźniej do (UTC): ${until.toISOString()}`,
      `Kod błędu: ${errorCode}`,
      "",
      "Szczegóły w logu API (Fly) pod zdarzeniem reset_tokens_revoke_failed.",
    ].join("\n"),
  };
}
