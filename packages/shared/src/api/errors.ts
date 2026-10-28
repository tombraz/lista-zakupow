import type { FieldErrorCode } from "./account";

/** Kody błędów reguł biznesowych (rzucane przez domenę API). */
export type DomainErrorCode = "not_found" | "owner_only" | "limit_reached";

/** Kody błędów API (architecture.md, „Konwencje API i błędów”); klient mapuje je na teksty. */
export type ErrorCode =
  | DomainErrorCode
  | "validation_failed"
  | "unauthenticated"
  | "invalid_credentials"
  | "invalid_origin"
  | "email_taken"
  | "rate_limited"
  | "internal";

/** Który limit biznesowy został osiągnięty (`limit_reached`). */
export type LimitName = "lists" | "items" | "participants";

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    fields?: Partial<Record<string, FieldErrorCode>>;
    limit?: LimitName;
  };
}
