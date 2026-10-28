import type { Item } from "@lista/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { asRequestError, type RequestErrorCode } from "../../api/client";
import { checkItem } from "../../api/items";
import { listKey } from "../../lists/useList";
import { replaceItem } from "./itemsCache";
import { messages } from "./messages";

/** Gdzie przenieść fokus po zapisie: checkbox pozycji albo przycisk sekcji „Kupione”. */
export type CheckFocus = { itemId: string } | "bought";

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
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [failure, setFailure] = useState<RequestErrorCode | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const settle = (itemId: string) => {
    setSaving((current) => new Set([...current].filter((id) => id !== itemId)));
  };

  const saved = (item: Item, checked: boolean) => {
    if (checked) {
      setAnnouncement(messages.checked(item.name));
      onFocus(neighbourOf(items, item.id), item);
    } else {
      onFocus({ itemId: item.id }, item);
    }
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
  const mutation = useMutation({
    mutationFn: ({ itemId, checked }: { itemId: string; checked: boolean }) =>
      checkItem(listId, itemId, checked),
    onSuccess: (updated, { checked }) => {
      saved(updated, checked);
    },
    onError: failed,
    onSettled: (_data, _error, { itemId }) => {
      settle(itemId);
    },
  });

  const toggle = (item: Item) => {
    if (saving.has(item.id)) return;
    setFailure(null);
    setSaving((current) => new Set(current).add(item.id));
    mutation.mutate({ itemId: item.id, checked: !item.checked });
  };

  return { toggle, isSaving: (itemId: string) => saving.has(itemId), failure, announcement };
}

export type CheckItemState = ReturnType<typeof useCheckItem>;

/** Następna nieodhaczona po `itemId`, przy ostatniej poprzednia; bez nich sekcja „Kupione”. */
function neighbourOf(items: Item[], itemId: string): CheckFocus {
  const toBuy = items.filter((item) => !item.checked);
  const index = toBuy.findIndex((item) => item.id === itemId);
  const neighbour = toBuy[index + 1] ?? toBuy[index - 1];
  return neighbour ? { itemId: neighbour.id } : "bought";
}
