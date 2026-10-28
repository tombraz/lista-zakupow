import type { DomainErrorCode, LimitName } from "@lista/shared";

/** Zdarzenie do logu `security` (architecture.md, „Obserwowalność”): tylko identyfikatory. */
export interface SecurityEvent {
  event: string;
  ids: Record<string, string>;
}

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
