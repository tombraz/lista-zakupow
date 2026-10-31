import type { RequestErrorCode } from "../../api/client";
import { errorText } from "../../errorText";

/** Teksty z tabeli „Copy” SC-01 (docs/design/screens/SC-01-logowanie.md). */
export const messages = {
  title: "Zaloguj się",
  email: { label: "E-mail", required: "Wpisz adres e-mail" },
  password: { label: "Hasło", required: "Wpisz hasło" },
  submit: "Zaloguj się",
  noAccount: "Nie masz konta?",
  register: "Załóż konto",
  invitation: (list: string) => `Zaloguj się, żeby dołączyć do listy „${list}”.`,
};

/** Kod błędu API → komunikat nad formularzem (F-02: bez wskazania, co było złe). */
export function formErrorText(code: RequestErrorCode): string {
  return errorText(code, {
    invalid_credentials: "Nieprawidłowy e-mail lub hasło.",
    rate_limited: "Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut albo zresetuj hasło.",
    otherwise: "Nie udało się zalogować. Spróbuj ponownie.",
  });
}
