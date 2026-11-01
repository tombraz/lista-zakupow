import type { FieldErrorCode } from "@lista/shared";
import { useState, type RefObject } from "react";
import { useFieldFocus } from "../../components/useFocus";

type ItemField = "name" | "note";

export type ItemFieldErrors = Partial<Record<ItemField, FieldErrorCode>>;

const ORDER: ItemField[] = ["name", "note"];

/**
 * Błędy pól nazwy i notatki pozycji (AddBar, arkusz edycji): nowy błąd — ze schematu albo z API —
 * przenosi fokus na pierwsze pole z błędem (T-060 AC4).
 */
export function useItemFieldErrors(fields: Record<ItemField, RefObject<HTMLElement | null>>) {
  const [errors, setErrors] = useState<ItemFieldErrors>({});
  const focusField = useFieldFocus(fields);
  const showErrors = (next: ItemFieldErrors) => {
    setErrors(next);
    const first = ORDER.find((field) => next[field]);
    if (first) focusField(first);
  };
  return [errors, showErrors] as const;
}
