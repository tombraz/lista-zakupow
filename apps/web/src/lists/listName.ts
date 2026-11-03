import { listNameRequestSchema, LIST_NAME_MAX_LENGTH, type FieldErrorCode } from "@lista/shared";
import { useState, type RefObject } from "react";
import { asRequestError, type RequestErrorCode } from "../api/client";
import { useGuardedMutation } from "../api/useGuardedMutation";
import { useFieldFocus } from "../components/useFocus";
import { HIDDEN_CHARACTERS_TEXT } from "../errorText";

export { LIST_NAME_MAX_LENGTH };

/** Błędy pola nazwy listy z SC-05 („Error — nazwa”); te same w zmianie nazwy na SC-06. */
export function listNameErrorText(code: FieldErrorCode): string {
  if (code === "too_long")
    return `Nazwa listy może mieć najwyżej ${String(LIST_NAME_MAX_LENGTH)} znaków`;
  return code === "invalid" ? HIDDEN_CHARACTERS_TEXT : "Wpisz nazwę listy";
}

interface ListNameFormOptions<T> {
  initial?: string;
  /** Pole nazwy: dostaje fokus po błędzie (T-060 AC4). */
  fieldRef: RefObject<HTMLInputElement | null>;
  save: (name: string) => Promise<T>;
  onSaved: (result: T) => void;
  /** Błąd żądania inny niż błąd pola (np. limit, brak połączenia). */
  onFailure: (code: RequestErrorCode) => void;
}

/**
 * Pole nazwy listy: walidacja schematem z `packages/shared` przed wysłaniem, błąd pola z API
 * (400) przy polu, inne błędy żądania do `onFailure`.
 */
export function useListNameForm<T>(options: ListNameFormOptions<T>) {
  const { initial = "", fieldRef, save, onSaved, onFailure } = options;
  const [name, setName] = useState(initial);
  const [fieldError, setError] = useState<FieldErrorCode | null>(null);
  const focusField = useFieldFocus({ name: fieldRef });
  const setFieldError = (code: FieldErrorCode) => {
    setError(code);
    focusField("name");
  };
  const mutation = useGuardedMutation({
    mutationFn: save,
    onSuccess: onSaved,
    onError: (error) => {
      const { code, fields } = asRequestError(error);
      if (fields["name"]) setFieldError(fields["name"]);
      else onFailure(code);
    },
  });

  const submit = () => {
    const parsed = listNameRequestSchema.safeParse({ name });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message as FieldErrorCode);
      return;
    }
    setError(null);
    mutation.mutate(parsed.data.name);
  };

  return { name, setName, fieldError, submit, pending: mutation.isPending };
}
