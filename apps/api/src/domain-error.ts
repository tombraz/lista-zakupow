import type { DomainErrorCode, LimitKey, LimitName } from "@lista/shared";

/** Zdarzenie do logu `security` (architecture.md, „Obserwowalność”): tylko identyfikatory. */
export type SecurityEvent =
  | { event: "list_access_denied"; ids: Record<string, string> }
  | {
      event: "limit_reached" | "rate_limited";
      /** Klucz stałej limitu (np. `listsPerOwner`), nie nazwa z odpowiedzi API (T-035). */
      limit: LimitKey;
      ids: Record<string, string>;
    };

/**
 * Błąd reguły biznesowej z kodem z `packages/shared`. Domena nie zna HTTP: status nadaje
 * jeden handler (`http/api-error.ts`).
 */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    readonly details: { limit?: LimitName; listId?: string; security?: SecurityEvent } = {},
  ) {
    super(code);
  }
}
