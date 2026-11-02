import type { QueryClient } from "@tanstack/react-query";

/** Usuwanie listy przez tego domownika (mutacja TanStack Query): zdarzenie `list.deleted` to jego zmiana. */
export const deleteListKey = (listId: string) => ["deleteList", listId] as const;

/** Opuszczanie listy przez tego domownika: zdarzenie `access.revoked` to jego zmiana (F-13). */
export const leaveListKey = (listId: string) => ["leaveList", listId] as const;

/**
 * Ta karta sama usuwa listę albo z niej wychodzi: utratę dostępu na żywo pomija, bo na SC-05
 * prowadzi odpowiedź zapisu, bez komunikatu o odebranym dostępie.
 */
export function isExitingOnItsOwn(client: QueryClient, listId: string): boolean {
  return [deleteListKey(listId), leaveListKey(listId)].some(
    (mutationKey) => client.isMutating({ mutationKey }) > 0,
  );
}
