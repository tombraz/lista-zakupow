import { z } from "zod";
import { requiredName } from "./text";

export const NAME_MAX_LENGTH = 30;
export const PASSWORD_MIN_LENGTH = 8;
// Górna granica Better Auth (domyślne maxPasswordLength); dłuższe hasło i tak by odrzucił.
export const PASSWORD_MAX_LENGTH = 128;

/** Wersja regulaminu i polityki prywatności zapisywana przy rejestracji (F-01). */
export const TERMS_VERSION = "2026-10-27";

/** Kod błędu pola w `error.fields`; klient mapuje go na tekst przy polu. */
export type FieldErrorCode = "required" | "invalid" | "too_short" | "too_long";

const consent = z.literal(true, { error: "required" });

const name = requiredName(NAME_MAX_LENGTH);

const signUpEmail = z
  .string({ error: "required" })
  .trim()
  .min(1, { error: "required" })
  .pipe(z.email({ error: "invalid" }))
  .transform((value) => value.toLowerCase());

const newPassword = z
  .string({ error: "required" })
  .min(PASSWORD_MIN_LENGTH, { error: "too_short" })
  .max(PASSWORD_MAX_LENGTH, { error: "too_long" });

export const signUpRequestSchema = z.object({
  name,
  email: signUpEmail,
  password: newPassword,
  termsAccepted: consent,
  ageConfirmed: consent,
  // F-12: zły token nie blokuje rejestracji (api.md), więc tu tylko typ; ważność sprawdza API.
  invitationToken: z.string().optional(),
});

export type SignUpRequest = z.input<typeof signUpRequestSchema>;

export const signInRequestSchema = z.object({
  email: z.string({ error: "required" }).trim().min(1, { error: "required" }),
  password: z.string({ error: "required" }).min(1, { error: "required" }),
});

export type SignInRequest = z.input<typeof signInRequestSchema>;

export const meResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

export type Me = z.infer<typeof meResponseSchema>;

/** Pierwszy błąd każdego pola najwyższego poziomu, np. `{ name: "too_long" }`. */
export function fieldErrors(error: z.ZodError): Partial<Record<string, FieldErrorCode>> {
  const fields: Partial<Record<string, FieldErrorCode>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in fields)) {
      fields[field] = issue.message as FieldErrorCode;
    }
  }
  return fields;
}
