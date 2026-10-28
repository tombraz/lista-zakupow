import { useQuery } from "@tanstack/react-query";
import { fetchLists } from "../api/lists";

export const LISTS_KEY = ["lists"] as const;

/** Listy domownika z `GET /api/v1/lists` (SC-05). */
export function useLists() {
  return useQuery({ queryKey: LISTS_KEY, queryFn: fetchLists });
}
