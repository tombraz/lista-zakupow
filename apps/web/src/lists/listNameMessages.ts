import { LIST_NAME_MAX_LENGTH, type FieldErrorCode } from "@lista/shared";
import { HIDDEN_CHARACTERS_TEXT } from "../errorTextMessages";

/** Błędy pola nazwy listy z SC-05 („Error — nazwa”); te same w zmianie nazwy na SC-06. */
export function listNameErrorText(code: FieldErrorCode): string {
  if (code === "too_long")
    return `Nazwa listy może mieć najwyżej ${String(LIST_NAME_MAX_LENGTH)} znaków`;
  return code === "invalid" ? HIDDEN_CHARACTERS_TEXT : "Wpisz nazwę listy";
}
