import type { FieldErrorCode } from "@lista/shared";
import type { RequestErrorCode } from "../../api/client";
import { errorText } from "../../errorText";

export type SignUpField = "name" | "email" | "password" | "termsAccepted" | "ageConfirmed";

/** Teksty z tabeli „Copy” SC-02 (docs/design/screens/SC-02-rejestracja.md). */
export const messages = {
  title: "Załóż konto",
  name: { label: "Imię", hint: "Tak zobaczą Cię inni na wspólnych listach." },
  email: { label: "E-mail" },
  password: { label: "Hasło", hint: "Co najmniej 8 znaków." },
  consent: { accept: "Akceptuję", terms: "regulamin", and: "i", privacy: "politykę prywatności" },
  age: "Mam ukończone 16 lat.",
  submit: "Załóż konto",
  haveAccount: "Masz już konto?",
  signIn: "Zaloguj się",
  invitation: (list: string) => `Po założeniu konta dołączysz do listy „${list}”.`,
  emailTaken: {
    before: "Konto z tym adresem już istnieje.",
    signIn: "Zaloguj się",
    or: "albo",
    reset: "zresetuj hasło",
  },
};

/** Kod błędu pola z API lub schematu → tekst pod polem. */
export const fieldMessages: Record<SignUpField, Partial<Record<FieldErrorCode, string>>> = {
  name: {
    required: "Wpisz imię",
    invalid: "Wpisz imię",
    too_long: "Imię może mieć najwyżej 30 znaków",
  },
  email: { required: "Wpisz poprawny adres e-mail", invalid: "Wpisz poprawny adres e-mail" },
  password: {
    required: "Hasło musi mieć co najmniej 8 znaków",
    too_short: "Hasło musi mieć co najmniej 8 znaków",
    too_long: "Hasło może mieć najwyżej 128 znaków",
  },
  termsAccepted: { required: "Zaakceptuj regulamin i politykę prywatności" },
  ageConfirmed: { required: "Potwierdź, że masz ukończone 16 lat" },
};

/** Błąd całego formularza (nie pola) → komunikat nad formularzem. */
export function formErrorText(code: RequestErrorCode): string {
  return errorText(code, {
    rate_limited: "Zbyt wiele prób rejestracji. Spróbuj ponownie później.",
    otherwise: "Nie udało się założyć konta. Spróbuj ponownie.",
  });
}

const FIELD_FORMS = { one: "pole", few: "pola", many: "pól", other: "pola" } as const;
const plural = new Intl.PluralRules("pl-PL");

/** „Popraw 1 pole”, „Popraw 2 pola”, „Popraw 5 pól”. */
export function fixFields(count: number): string {
  const form = plural.select(count) as keyof typeof FIELD_FORMS;
  return `Popraw ${String(count)} ${FIELD_FORMS[form]}`;
}
