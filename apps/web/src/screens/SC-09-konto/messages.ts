import type { RequestErrorCode } from "../../api/client";
import { errorText } from "../../errorText";

/** Teksty z tabeli „Copy” SC-09 (docs/design/screens/SC-09-konto.md). */
export const messages = {
  title: "Konto",
  back: "Wstecz",
  section: "Twoje dane",
  email: "E-mail",
  name: "Imię",
  logout: "Wyloguj się",
  legal: "Regulamin i polityka prywatności",
};

/** Błąd wylogowania → komunikat (tekst agenta; tabela „Copy” go nie ma). */
export function logoutErrorText(code: RequestErrorCode): string {
  return errorText(code, { otherwise: "Nie udało się wylogować. Spróbuj ponownie." });
}
