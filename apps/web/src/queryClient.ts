import { QueryClient } from "@tanstack/react-query";
import { asRequestError } from "./api/client";

const MAX_RETRIES = 3;

/**
 * Ponawiane są tylko awarie (sieć, 5xx). Odpowiedź 4xx (np. 404 brak dostępu do listy) jest
 * ostateczna: ponawianie tylko opóźniłoby komunikat.
 */
export function shouldRetry(failures: number, error: unknown): boolean {
  const { status } = asRequestError(error);
  return (status === 0 || status >= 500) && failures < MAX_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } });
}
