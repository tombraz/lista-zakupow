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

const newestFirst = (a: string | null, b: string | null) => (b ?? "").localeCompare(a ?? "");

/**
 * Kolejność jak w API (data-model.md, „Kolejność”): nieodhaczone od najnowszej, pod nimi
 * odhaczone od ostatnio odhaczonej. Potrzebna, gdy pozycja zmienia sekcję po odpowiedzi API.
 */
export function inListOrder(items: Item[]): Item[] {
  return items.toSorted(
    (a, b) =>
      Number(a.checked) - Number(b.checked) ||
      newestFirst(a.checkedAt, b.checkedAt) ||
      newestFirst(a.createdAt, b.createdAt),
  );
}

/**
 * api.md: wersja pozycji zastępuje posiadaną tylko, gdy ma nowsze `updatedAt` — tak samo dla
 * odpowiedzi API i zdarzeń na żywo (F-14).
 */
export function isNewer(item: Item, current: Item | undefined): boolean {
  return !current || current.updatedAt < item.updatedAt;
}

/**
 * Pozycja potwierdzona przez API zastępuje swoją poprzednią wersję, chyba że na żywo przyszła
 * już nowsza (zmiana innej osoby przed spóźnioną odpowiedzią). Usuniętej nie przywraca.
 */
export function replaceItem(client: QueryClient, listId: string, item: Item) {
  updateItems(client, listId, (items) =>
    inListOrder(
      items.map((current) => (current.id === item.id && isNewer(item, current) ? item : current)),
    ),
  );
}

/** Pozycje usunięte na żywo — klient nie przywraca ich spóźnioną odpowiedzią API (F-14). */
const deletedItems = new WeakMap<QueryClient, Set<string>>();

/** Usunięcie pozycji z cache; zapamiętane, bo usunięcie wygrywa ze zmianą (F-14). */
export function removeItems(client: QueryClient, listId: string, itemIds: readonly string[]) {
  const deleted = deletedItems.get(client) ?? new Set<string>();
  for (const id of itemIds) deleted.add(id);
  deletedItems.set(client, deleted);
  updateItems(client, listId, (items) => items.filter(({ id }) => !deleted.has(id)));
}

/**
 * Nowa albo zmieniona pozycja (odpowiedź na dodanie, zdarzenie na żywo) wchodzi do cache tylko,
 * gdy jest nowsza od posiadanej i nie została usunięta. `false`, gdy nic się nie zmieniło.
 */
export function upsertNewer(client: QueryClient, listId: string, item: Item): boolean {
  if (deletedItems.get(client)?.has(item.id)) return false;
  let applied = false;
  updateItems(client, listId, (items) => {
    const current = items.find(({ id }) => id === item.id);
    if (!isNewer(item, current)) return items;
    applied = true;
    return inListOrder([item, ...items.filter(({ id }) => id !== item.id)]);
  });
  return applied;
}
