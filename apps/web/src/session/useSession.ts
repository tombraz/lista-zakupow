import type { Me } from "@lista/shared";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { fetchMe } from "../api/account";
import { ApiRequestError } from "../api/client";

const SESSION_KEY = ["me"] as const;
/** Powód końca sesji, który SC-01 ogłasza (F-04: „Konto zostało usunięte.”). */
const SESSION_END_KEY = ["sessionEnd"] as const;

export type SessionEnd = "accountDeleted";

/** Stan sesji z `GET /api/v1/me`; `data === null` = niezalogowany. */
export function useSession() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: fetchMe, staleTime: Infinity });
}

/**
 * Bez sesji dane poprzedniego domownika nie zostają w cache. Zapytanie sesji zostaje, tylko
 * dostaje `null`: obserwuje je `RequireSession`, a `clear()` odcięłoby go od nowej wartości.
 */
function endSession(client: QueryClient, reason?: SessionEnd) {
  client.setQueryData(SESSION_KEY, null);
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] });
  client.getMutationCache().clear();
  if (reason) client.setQueryData(SESSION_END_KEY, reason);
}

/** Ustawia zalogowanego domownika po rejestracji, logowaniu albo wylogowaniu (`null`). */
export function useSetSession() {
  const client = useQueryClient();
  return (user: Me | null) => {
    if (!user) {
      endSession(client);
      return;
    }
    client.removeQueries({ queryKey: SESSION_END_KEY });
    client.setQueryData(SESSION_KEY, user);
  };
}

/**
 * Kończy sesję z powodem, który SC-01 ogłasza. Na SC-01 prowadzi wtedy tylko `RequireSession`
 * (czyta powód): nawigacja ekranu obok jego przekierowania ścigałaby się z nim i gubiła komunikat.
 */
export function useEndSession() {
  const client = useQueryClient();
  return (reason: SessionEnd) => {
    endSession(client, reason);
  };
}

/** Powód ostatniego końca sesji w tej karcie albo `undefined` (zwykłe wylogowanie, 401). */
export function useSessionEnd(): SessionEnd | undefined {
  return useQueryClient().getQueryData<SessionEnd>(SESSION_END_KEY);
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
