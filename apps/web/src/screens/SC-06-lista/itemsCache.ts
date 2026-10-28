import type { Item, ListDetails } from "@lista/shared";
import type { QueryClient } from "@tanstack/react-query";
import { listKey } from "../../lists/useList";

/** Pozycje listy w cache po potwierdzonej przez API zmianie (bez optymistycznych zmian, F-15). */
export function updateItems(
  client: QueryClient,
  listId: string,
  change: (items: Item[]) => Item[],
) {
  client.setQueryData<ListDetails>(
    listKey(listId),
    (current) => current && { ...current, items: change(current.items) },
  );
}
