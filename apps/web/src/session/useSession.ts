import type { Me } from "@lista/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe } from "../api/account";

const SESSION_KEY = ["me"] as const;

/** Stan sesji z `GET /api/v1/me`; `data === null` = niezalogowany. */
export function useSession() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: fetchMe, staleTime: Infinity });
}

/** Ustawia zalogowanego domownika po rejestracji, logowaniu albo wylogowaniu (`null`). */
export function useSetSession() {
  const client = useQueryClient();
  return (user: Me | null) => {
    if (!user) client.clear();
    client.setQueryData(SESSION_KEY, user);
  };
}
