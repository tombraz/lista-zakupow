import { useQuery } from "@tanstack/react-query";
import { fetchMembers } from "../api/lists";
import { listKey } from "./useList";

export const membersKey = (listId: string) => [...listKey(listId), "members"] as const;

/** Właściciel i uczestnicy listy z `GET /api/v1/lists/:listId/members` (SC-07, F-13). */
export function useMembers(listId: string) {
  return useQuery({ queryKey: membersKey(listId), queryFn: () => fetchMembers(listId) });
}
