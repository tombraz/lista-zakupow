import type { RequestErrorCode } from "../../api/client";
import { errorText } from "../../errorText";

/** Teksty z tabeli „Copy” SC-03, krok 1 (docs/design/screens/SC-03-reset-hasla.md). */
export const messages = {
  title: "Reset hasła",
  intro: "Podaj e-mail konta. Wyślemy link do ustawienia nowego hasła.",
  email: { label: "E-mail", invalid: "Wpisz poprawny adres e-mail" },
  submit: "Wyślij link",
  // F-03, TH-11: ten sam komunikat bez względu na to, czy konto istnieje.
  sent: (email: string) =>
    `Jeśli konto z adresem ${email} istnieje, wysłaliśmy na nie link. Link jest ważny 1 godzinę.`,
  back: "Wróć do logowania",
};

/** Kod błędu API → komunikat nad formularzem. */
export function formErrorText(code: RequestErrorCode): string {
  return errorText(code, {
    rate_limited: "Zbyt wiele próśb o reset. Spróbuj ponownie za kilka minut.",
    otherwise: "Nie udało się wysłać linku. Spróbuj ponownie.",
  });
}
