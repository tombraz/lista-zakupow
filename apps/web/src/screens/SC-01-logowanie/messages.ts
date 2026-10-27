import type { RequestErrorCode } from "../../api/client";

/** Teksty z tabeli „Copy” SC-01 (docs/design/screens/SC-01-logowanie.md). */
export const messages = {
  title: "Zaloguj się",
  email: { label: "E-mail", required: "Wpisz adres e-mail" },
  password: { label: "Hasło", required: "Wpisz hasło" },
  submit: "Zaloguj się",
  noAccount: "Nie masz konta?",
  register: "Załóż konto",
};

/** Kod błędu API → komunikat nad formularzem (F-02: bez wskazania, co było złe). */
export function formErrorText(code: RequestErrorCode): string {
  switch (code) {
    case "invalid_credentials":
      return "Nieprawidłowy e-mail lub hasło.";
    case "rate_limited":
      return "Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut albo zresetuj hasło.";
    case "network":
      return "Brak połączenia. Sprawdź internet i spróbuj ponownie.";
    default:
      return "Nie udało się zalogować. Spróbuj ponownie.";
  }
}
