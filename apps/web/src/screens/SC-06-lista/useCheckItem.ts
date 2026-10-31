import type { Item } from "@lista/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { asRequestError, type RequestErrorCode } from "../../api/client";
import { checkItem } from "../../api/items";
import { useGuardedMutation } from "../../api/useGuardedMutation";
import { listKey } from "../../lists/useList";
import { replaceItem } from "./itemsCache";
import { messages } from "./messages";

/**
 * Gdzie przenieść fokus po zapisie: checkbox pozycji albo pierwszej z `unchecked`, która na
 * ekranie jest jeszcze nieodhaczona (bez takiej przycisk sekcji „Kupione”).
 */
export type CheckFocus = { itemId: string } | { unchecked: string[] };

interface Toggle {
  itemId: string;
  checked: boolean;
  /** Fokus po zapisie (SC-06, „Accessibility”). */
  next: CheckFocus;
}

interface CheckOptions {
  /** Pozycje z cache w kolejności z API. */
  items: Item[];
  /** `settled`: zapisana pozycja — fokus, gdy lista na ekranie już ją pokazuje. */
  onFocus: (target: CheckFocus, settled: Item) => void;
}

/**
 * Checkbox SC-06 (F-08, F-10): zmiana widoczna dopiero po odpowiedzi API (F-15), w czasie zapisu
 * kolejne kliknięcia tej pozycji nic nie wysyłają. Po odhaczeniu fokus na następnej nieodhaczonej
 * (przy ostatniej na poprzedniej) i ogłoszenie „Odhaczono <nazwa>” (SC-06, „Accessibility”).
 */
export function useCheckItem(listId: string, { items, onFocus }: CheckOptions) {
  const client = useQueryClient();
  const [failure, setFailure] = useState<RequestErrorCode | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const saved = (item: Item, { checked, next }: Toggle) => {
    if (checked) setAnnouncement(messages.checked(item.name));
    onFocus(next, item);
    replaceItem(client, listId, item);
  };

  const failed = (error: unknown) => {
    const { code } = asRequestError(error);
    // F-14: pozycję usunęła inna osoba — pokazujemy aktualny stan listy.
    if (code === "not_found") void client.invalidateQueries({ queryKey: listKey(listId) });
    else setFailure(code);
  };

  // Wywołania zwrotne hooka, nie `mutate`: te drugie dostaje tylko ostatnie z równoległych
  // odhaczeń różnych pozycji (TanStack Query).
  const mutation = useGuardedMutation(
    {
      mutationFn: ({ itemId, checked }: Toggle) => checkItem(listId, itemId, checked),
      onMutate: () => {
        setFailure(null);
      },
      onSuccess: (updated, toggled) => {
        saved(updated, toggled);
      },
      onError: failed,
    },
    // Różne pozycje można odhaczać naraz; tę samą tylko raz w czasie zapisu (T-030).
    ({ itemId }) => itemId,
  );

  const toggle = (item: Item) => {
    const checked = !item.checked;
    // Kandydaci z kolejności w chwili kliknięcia: zdarzenie na żywo tej samej zmiany może
    // przenieść pozycję do „Kupione” przed odpowiedzią API (F-14). Wybór przy fokusie, bo sąsiad
    // mógł zostać odhaczony w międzyczasie (T-039).
    const next = checked ? focusCandidates(items, item.id) : { itemId: item.id };
    mutation.mutate({ itemId: item.id, checked, next });
  };

  return { toggle, isSaving: (itemId: string) => mutation.isLocked(itemId), failure, announcement };
}

export type CheckItemState = ReturnType<typeof useCheckItem>;

/** Kandydaci fokusu: nieodhaczone po `itemId`, potem przed nią od najbliższej. */
function focusCandidates(items: Item[], itemId: string): CheckFocus {
  const toBuy = items.filter((item) => !item.checked).map((item) => item.id);
  const index = toBuy.indexOf(itemId);
  return { unchecked: [...toBuy.slice(index + 1), ...toBuy.slice(0, index).reverse()] };
}
