import type { ListDetails, ListEvent, LiveServerMessage } from "@lista/shared";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { deleteListKey } from "../lists/deleteListKey";
import { listKey } from "../lists/useList";
import { LISTS_KEY } from "../lists/useLists";
import { removeItems, upsertNewer } from "../screens/SC-06-lista/itemsCache";
import { useLive } from "./LiveProvider";

// SC-06 „Live update”: zmieniony wiersz krótko podświetlony.
const HIGHLIGHT_MS = 2000;

/** Stan nawigacji SC-05 po utracie dostępu do otwartej listy (SC-05 „Info — usunięto dostęp”). */
export interface RemovedListState {
  removedList: string;
}

/**
 * Zmiany innych osób na otwartej liście (SC-06, SC-07): subskrypcja kanału listy, zdarzenia
 * w cache TanStack Query, po ponownym połączeniu pełny stan listy (F-14, F-15). Utrata dostępu
 * (lista usunięta, MC-03) od razu prowadzi na SC-05 z komunikatem.
 */
export function useLiveList(listId: string) {
  const live = useLive();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!live) return;
    const highlight = (itemId: string) => {
      // design-system.md: przy „ogranicz ruch” bez podświetlenia zmian. Zdarzenie przy zapisie
      // w toku to zwykle własna zmiana (przychodzi przed odpowiedzią API): też bez podświetlenia.
      if (prefersReducedMotion() || client.isMutating() > 0) return;
      setHighlighted((ids) => new Set(ids).add(itemId));
      setTimeout(() => {
        setHighlighted((ids) => withoutId(ids, itemId));
      }, HIGHLIGHT_MS);
    };
    const leave = () => {
      // Właściciel sam usuwa listę: DeleteListDialog prowadzi na SC-05 bez komunikatu.
      const list = client.getQueryData<ListDetails>(listKey(listId));
      if (!list || client.isMutating({ mutationKey: deleteListKey(listId) }) > 0) return;
      client.removeQueries({ queryKey: listKey(listId) });
      void client.invalidateQueries({ queryKey: LISTS_KEY, exact: true });
      const state: RemovedListState = { removedList: list.name };
      void navigate("/listy", { replace: true, state });
    };
    const stopListening = live.onMessage((message) => {
      if (!("listId" in message) || message.listId !== listId) return;
      if (message.type === "list.deleted" || message.type === "access.revoked") leave();
      else if (isListEvent(message)) {
        const changed = applyListEvent(client, message);
        if (changed) highlight(changed);
      }
    });
    const stopRefreshing = live.onReconnect(() => {
      void client.invalidateQueries({ queryKey: listKey(listId) });
    });
    const unsubscribe = live.subscribe(listId);
    return () => {
      unsubscribe();
      stopListening();
      stopRefreshing();
    };
  }, [live, client, navigate, listId]);

  return { highlighted };
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

function withoutId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const left = new Set(ids);
  left.delete(id);
  return left;
}

const LIST_EVENTS = new Set<string>([
  "item.upserted",
  "item.deleted",
  "items.cleared",
  "list.updated",
  "members.changed",
]);

function isListEvent(message: LiveServerMessage): message is ListEvent {
  return LIST_EVENTS.has(message.type);
}

/** Zastosowanie zdarzenia w cache listy; zwraca pozycję zmienioną przez inną osobę. */
function applyListEvent(client: QueryClient, event: ListEvent): string | null {
  const { listId } = event;
  switch (event.type) {
    case "item.upserted":
      return upsertNewer(client, listId, event.item) ? event.item.id : null;
    case "item.deleted":
      removeItems(client, listId, [event.itemId]);
      return null;
    case "items.cleared":
      removeItems(client, listId, event.itemIds);
      return null;
    case "list.updated":
      // F-05: nowa nazwa w AppBar.
      client.setQueryData<ListDetails>(
        listKey(listId),
        (current) => current && { ...current, name: event.name },
      );
      return null;
    default:
      // `members.changed`: uczestnicy z API (SC-06 okno usunięcia, SC-07).
      void client.invalidateQueries({ queryKey: listKey(listId), exact: true });
      return null;
  }
}
