import { listNameRequestSchema, LIST_NAME_MAX_LENGTH, type FieldErrorCode } from "@lista/shared";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { asRequestError, type RequestErrorCode } from "../api/client";

export { LIST_NAME_MAX_LENGTH };

/** Błędy pola nazwy listy z SC-05 („Error — nazwa”); te same w zmianie nazwy na SC-06. */
export function listNameErrorText(code: FieldErrorCode): string {
  return code === "too_long"
    ? `Nazwa listy może mieć najwyżej ${String(LIST_NAME_MAX_LENGTH)} znaków`
    : "Wpisz nazwę listy";
}

interface ListNameFormOptions<T> {
  initial?: string;
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
  const { initial = "", save, onSaved, onFailure } = options;
  const [name, setName] = useState(initial);
  const [fieldError, setFieldError] = useState<FieldErrorCode | null>(null);
  const mutation = useMutation({ mutationFn: save });

  const submit = () => {
    const parsed = listNameRequestSchema.safeParse({ name });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message as FieldErrorCode);
      return;
    }
    setFieldError(null);
    mutation.mutate(parsed.data.name, {
      onSuccess: onSaved,
      onError: (error) => {
        const { code, fields } = asRequestError(error);
        if (fields["name"]) setFieldError(fields["name"]);
        else onFailure(code);
      },
    });
  };

  return { name, setName, fieldError, submit, pending: mutation.isPending };
}
