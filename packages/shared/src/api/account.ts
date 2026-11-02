import { z } from "zod";
import { requiredName, withoutNul } from "./text";

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

// Ta sama skrzynka bez względu na wielkość liter i spacje (rejestracja, reset hasła).
const accountEmail = z
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
  email: accountEmail,
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

// F-03: `redirectTo` z api.md jest przyjmowany, ale pomijany — link w mailu zawsze na originie
// aplikacji (TH-14), więc schemat go nie przepuszcza dalej.
export const passwordResetRequestSchema = z.object({ email: accountEmail });

export type PasswordResetRequest = z.input<typeof passwordResetRequestSchema>;

// F-03: nowe hasło z linku resetu; token z adresu strony `/reset-hasla?token=`.
export const passwordResetSchema = z.object({
  token: z
    .string({ error: "required" })
    .min(1, { error: "required" })
    .refine(withoutNul, { error: "invalid" }),
  newPassword,
});

export type PasswordReset = z.input<typeof passwordResetSchema>;

// F-16: zmiana imienia (SC-09); inne pola żądania (np. `email`) schemat pomija.
export const nameChangeRequestSchema = z.object({ name });

export type NameChangeRequest = z.input<typeof nameChangeRequestSchema>;

// F-04: usunięcie konta tylko z wyraźnym potwierdzeniem (api.md, „Konto”).
export const accountDeletionRequestSchema = z.object({
  confirm: z.literal(true, { error: "required" }),
});

export type AccountDeletionRequest = z.input<typeof accountDeletionRequestSchema>;

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
