import type { RequestErrorCode } from "../../api/client";
import { errorText } from "../../errorText";

/** Teksty z tabeli „Copy” SC-09 (docs/design/screens/SC-09-konto.md). */
export const messages = {
  title: "Konto",
  back: "Wstecz",
  section: "Twoje dane",
  email: "E-mail",
  name: "Imię",
  nameHint: "Tak zobaczą Cię inni na wspólnych listach.",
  nameSave: "Zapisz imię",
  nameSaved: "Imię zmienione",
  logout: "Wyloguj się",
  legal: "Regulamin i polityka prywatności",
};

/** Błąd wylogowania → komunikat (tekst agenta; tabela „Copy” go nie ma). */
export function logoutErrorText(code: RequestErrorCode): string {
  return errorText(code, { otherwise: "Nie udało się wylogować. Spróbuj ponownie." });
}

/** Błąd zapisu imienia inny niż błąd pola (SC-09 „Error — zapis”). */
export function saveErrorText(code: RequestErrorCode): string {
  return errorText(code, { otherwise: "Nie udało się zapisać. Spróbuj ponownie." });
}
