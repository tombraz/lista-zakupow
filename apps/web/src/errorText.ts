import type { RequestErrorCode } from "./api/client";

/** Teksty ekranu dla jego kodów błędów i tekst dla każdego innego kodu. */
export type ErrorTexts = Partial<Record<RequestErrorCode, string>> & { otherwise: string };

// Kody, które znaczą to samo na każdym ekranie (CODING_STANDARDS.md: mapowanie w jednym miejscu).
const COMMON: Partial<Record<RequestErrorCode, string>> = {
  network: "Brak połączenia. Sprawdź internet i spróbuj ponownie.",
};

/** Kod błędu żądania → komunikat: najpierw tekst ekranu, potem wspólny, na końcu domyślny. */
export function errorText(code: RequestErrorCode, texts: ErrorTexts): string {
  return texts[code] ?? COMMON[code] ?? texts.otherwise;
}
