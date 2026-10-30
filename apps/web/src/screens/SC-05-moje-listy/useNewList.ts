import { BUSINESS_LIMITS, type ListSummary } from "@lista/shared";
import { useEffect, useRef, useState } from "react";
import { useFocusRequest } from "../../components/useFocus";

/**
 * Formularz nowej listy w miejscu przycisku (SC-05): otwarcie, powrót fokusu po „Anuluj” / Esc
 * i limit 50 własnych list (F-05) — z przeglądu albo z odpowiedzi 409 API. Odmowa API trwa do
 * następnego stanu list z serwera (formularz go pobiera); potem decyduje liczba list (T-025).
 */
export function useNewList(lists: ListSummary[] | undefined) {
  const [open, setOpen] = useState(false);
  const [focus, requestFocus] = useFocusRequest<"trigger">();
  const [refusedFor, setRefusedFor] = useState<ListSummary[]>();
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focus) triggerRef.current?.focus();
  }, [focus]);

  const ownLists = lists?.filter((list) => list.role === "owner").length ?? 0;
  const refusedByApi = refusedFor !== undefined && refusedFor === lists;
  const limitReached = refusedByApi || ownLists >= BUSINESS_LIMITS.listsPerOwner;

  return {
    open: open && !limitReached,
    limitReached,
    triggerRef,
    show: () => {
      setOpen(true);
    },
    cancel: () => {
      setOpen(false);
      requestFocus("trigger");
    },
    refusedByLimit: () => {
      setRefusedFor(lists);
      setOpen(false);
    },
  };
}
