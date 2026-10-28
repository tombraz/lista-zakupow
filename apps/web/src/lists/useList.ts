import { useQuery } from "@tanstack/react-query";
import { asRequestError } from "../api/client";
import { fetchList } from "../api/lists";

export const listKey = (listId: string) => ["list", listId] as const;

/** Szczegóły listy z `GET /api/v1/lists/:listId` (SC-06); `noAccess` = 404 (MC-01). */
export function useList(listId: string) {
  const query = useQuery({ queryKey: listKey(listId), queryFn: () => fetchList(listId) });
  const noAccess = query.isError && asRequestError(query.error).code === "not_found";
  return { ...query, noAccess };
}
