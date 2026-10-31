import { z } from "zod";

// PostgreSQL nie zapisze NUL w kolumnie tekstowej; bez tego INSERT kończy się 500.
export const withoutNul = (text: string) => !text.includes("\u0000");

/** Wymagana nazwa (imię, nazwa listy, pozycji): obcięte brzegi, 1–`max` znaków, bez NUL. */
export function requiredName(max: number) {
  return z
    .string({ error: "required" })
    .trim()
    .min(1, { error: "required" })
    .max(max, { error: "too_long" })
    .refine(withoutNul, { error: "invalid" });
}
