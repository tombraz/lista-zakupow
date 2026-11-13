import type { RequestErrorCode } from "./api/client";

/**
 * Kody, które znaczą to samo na każdym ekranie (CODING_STANDARDS.md: mapowanie w jednym miejscu);
 * Copy każdego ekranu, który pokazuje błąd żądania (`errorText`).
 */
export const COMMON_ERROR_TEXTS: Partial<Record<RequestErrorCode, string>> = {
  network: "Brak połączenia. Sprawdź internet i spróbuj ponownie.",
};

/**
 * Błąd `invalid` pola tekstu widocznego dla innych (imię, nazwa listy i pozycji, notatka): znaki
 * ukryte, sterujące albo zmieniające kierunek tekstu (TH-29; copy zatwierdzone 2026-11-01).
 */
export const HIDDEN_CHARACTERS_TEXT = "Usuń niewidoczne lub specjalne znaki.";
