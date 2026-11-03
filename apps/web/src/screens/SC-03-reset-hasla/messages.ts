import type { FieldErrorCode } from "@lista/shared";
import type { RequestErrorCode } from "../../api/client";
import { errorText } from "../../errorText";

/** Teksty z tabeli „Copy” SC-03 (docs/design/screens/SC-03-reset-hasla.md). */
export const messages = {
  title: "Reset hasła",
  intro: "Podaj e-mail konta. Wyślemy link do ustawienia nowego hasła.",
  email: { label: "E-mail", invalid: "Wpisz poprawny adres e-mail" },
  submit: "Wyślij link",
  // F-03, TH-11: ten sam komunikat bez względu na to, czy konto istnieje.
  sent: (email: string) =>
    `Jeśli konto z adresem ${email} istnieje, wysłaliśmy na nie link. Link jest ważny 1 godzinę.`,
  back: "Wróć do logowania",
  step2: {
    title: "Ustaw nowe hasło",
    password: {
      label: "Nowe hasło",
      hint: "Co najmniej 8 znaków.",
      // Jak SC-02 (to samo pole „nowe hasło”, te same reguły).
      errors: {
        required: "Hasło musi mieć co najmniej 8 znaków",
        too_short: "Hasło musi mieć co najmniej 8 znaków",
        too_long: "Hasło może mieć najwyżej 128 znaków",
      } satisfies Partial<Record<FieldErrorCode, string>>,
    },
    submit: "Zapisz hasło",
    invalid: "Ten link wygasł albo został już użyty.",
    resend: "Wyślij nowy link",
  },
};

/** Krok 2: kod błędu pola „Nowe hasło” (schemat lub API) → tekst pod polem. */
export function passwordErrorText(code: FieldErrorCode): string {
  const { errors } = messages.step2.password;
  return code in errors ? errors[code as keyof typeof errors] : errors.too_short;
}

/** Krok 2: kod błędu zapisu hasła → komunikat nad formularzem (`invalid_token` ma osobny stan). */
export function saveErrorText(code: RequestErrorCode): string {
  return errorText(code, { otherwise: "Nie udało się zapisać hasła. Spróbuj ponownie." });
}

/** Kod błędu API → komunikat nad formularzem. */
export function formErrorText(code: RequestErrorCode): string {
  return errorText(code, {
    rate_limited: "Zbyt wiele próśb o reset. Spróbuj ponownie za kilka minut.",
    otherwise: "Nie udało się wysłać linku. Spróbuj ponownie.",
  });
}
