import type { Me } from "@lista/shared";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { fetchMe } from "../api/account";
import { ApiRequestError } from "../api/client";

const SESSION_KEY = ["me"] as const;

/** Stan sesji z `GET /api/v1/me`; `data === null` = niezalogowany. */
export function useSession() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: fetchMe, staleTime: Infinity });
}

/**
 * Bez sesji dane poprzedniego domownika nie zostają w cache. Zapytanie sesji zostaje, tylko
 * dostaje `null`: obserwuje je `RequireSession`, a `clear()` odcięłoby go od nowej wartości.
 */
function endSession(client: QueryClient) {
  client.setQueryData(SESSION_KEY, null);
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] });
  client.getMutationCache().clear();
}

/** Ustawia zalogowanego domownika po rejestracji, logowaniu albo wylogowaniu (`null`). */
export function useSetSession() {
  const client = useQueryClient();
  return (user: Me | null) => {
    if (user) client.setQueryData(SESSION_KEY, user);
    else endSession(client);
  };
}

const isUnauthenticated = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 401;

/**
 * Zalogowany dostaje 401 z `/api/v1/*`: sesja wygasła albo wylogowano go w innej karcie.
 * Kończy sesję w kliencie, więc `RequireSession` prowadzi na SC-01 i z powrotem (T-018).
 */
export function useEndSessionOnUnauthenticated() {
  const client = useQueryClient();
  useEffect(() => {
    const ended = (action: { type: string; error?: unknown }) => {
      if (action.type === "error" && isUnauthenticated(action.error)) endSession(client);
    };
    const stopQueries = client.getQueryCache().subscribe((event) => {
      if (event.type === "updated") ended(event.action);
    });
    const stopMutations = client.getMutationCache().subscribe((event) => {
      if (event.type === "updated") ended(event.action);
    });
    return () => {
      stopQueries();
      stopMutations();
    };
  }, [client]);
}

/** Sprawdza sesję w API (np. po zerwanym połączeniu na żywo); bez sesji kończy ją w kliencie. */
export function useCheckSession() {
  const client = useQueryClient();
  return useCallback(() => {
    fetchMe().then(
      (user) => {
        if (!user) endSession(client);
      },
      // Brak sieci: sesja mogła przetrwać, połączenie na żywo ponawia samo.
      () => undefined,
    );
  }, [client]);
}
