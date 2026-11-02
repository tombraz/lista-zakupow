import { NAME_MAX_LENGTH, type FieldErrorCode } from "@lista/shared";
import { HIDDEN_CHARACTERS_TEXT } from "../errorText";

/** Błędy pola „Imię” (F-16): rejestracja (SC-02) i zmiana imienia (SC-09). */
export const NAME_ERROR_TEXTS: Partial<Record<FieldErrorCode, string>> = {
  required: "Wpisz imię",
  invalid: HIDDEN_CHARACTERS_TEXT,
  too_long: `Imię może mieć najwyżej ${String(NAME_MAX_LENGTH)} znaków`,
};
