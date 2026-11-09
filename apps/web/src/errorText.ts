import type { RequestErrorCode } from "./api/client";
import { COMMON_ERROR_TEXTS } from "./errorTextMessages";

/** Teksty ekranu dla jego kodów błędów i tekst dla każdego innego kodu. */
export type ErrorTexts = Partial<Record<RequestErrorCode, string>> & { otherwise: string };

/** Kod błędu żądania → komunikat: najpierw tekst ekranu, potem wspólny, na końcu domyślny. */
export function errorText(code: RequestErrorCode, texts: ErrorTexts): string {
  return texts[code] ?? COMMON_ERROR_TEXTS[code] ?? texts.otherwise;
}
