import type { FieldErrorCode } from "./account";

/** Kody błędów API (architecture.md, „Konwencje API i błędów”); klient mapuje je na teksty. */
export type ErrorCode =
  | "validation_failed"
  | "unauthenticated"
  | "invalid_credentials"
  | "invalid_origin"
  | "not_found"
  | "email_taken"
  | "rate_limited"
  | "internal";

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    fields?: Partial<Record<string, FieldErrorCode>>;
  };
}
