import type { FieldErrorCode } from "./account";

/** Kody błędów reguł biznesowych (rzucane przez domenę API). */
export const DOMAIN_ERROR_CODES = [
  "not_found",
  "owner_only",
  "owner_cannot_leave",
  "limit_reached",
  "duplicate_item",
  "own_list",
  "already_member",
  "invitation_invalid",
  "rate_limited",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

/**
 * Kody błędów API (architecture.md, „Konwencje API i błędów”); klient mapuje je na teksty.
 * Każdy kod ma wiersz w tabeli błędów `architecture.md` (i odwrotnie) oraz wystąpienie w `api.md`
 * (`test/error-codes-docs.test.ts`, T-095, T-105).
 */
export const ERROR_CODES = [
  ...DOMAIN_ERROR_CODES,
  "validation_failed",
  "unauthenticated",
  "invalid_credentials",
  "invalid_origin",
  "email_taken",
  "invalid_token",
  "internal",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Który limit biznesowy został osiągnięty (`limit_reached`). */
export type LimitName = "lists" | "items" | "participants";

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    fields?: Partial<Record<string, FieldErrorCode>>;
    limit?: LimitName;
    /** Tylko przy `own_list` / `already_member`: lista, do której domownik już ma dostęp (SC-08 „Otwórz listę”). */
    listId?: string;
    /** Tylko przy `internal`: identyfikator żądania do odszukania szczegółów w logu. */
    requestId?: string;
  };
}
