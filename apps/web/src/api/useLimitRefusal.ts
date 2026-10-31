import { useState } from "react";

/**
 * Odmowa limitu z API (409 `limit_reached`) dla liczby na ekranie (listy w SC-05, pozycje w
 * SC-06). Pamięta liczbę z chwili odmowy i obowiązuje, dopóki liczba nie spadnie poniżej niej.
 * Gdy odświeżenie pokaże więcej (ekran nie znał zmian z innej karty), pamięta nową liczbę, więc
 * odmowa przy nieaktualnym ekranie wygasa po pierwszym usunięciu (T-042).
 */
export function useLimitRefusal(count: number) {
  const [atCount, setAtCount] = useState<number | null>(null);
  if (atCount !== null && count !== atCount) setAtCount(count < atCount ? null : count);
  return {
    refused: atCount !== null && count >= atCount,
    refuse: () => {
      setAtCount(count);
    },
  };
}
