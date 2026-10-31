/** Usuwanie listy przez tego domownika (mutacja TanStack Query): zdarzenie `list.deleted` to jego zmiana. */
export const deleteListKey = (listId: string) => ["deleteList", listId] as const;
