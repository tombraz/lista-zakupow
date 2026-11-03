import { fieldErrors } from "@lista/shared";
import type { z } from "zod";
import { ApiError } from "./api-error";

type Fields = ReturnType<typeof fieldErrors>;

/** Treść żądania przez schemat z `packages/shared`; błąd = 400 `validation_failed` z polami. */
export function validate<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "validation_failed", fieldErrors(parsed.error));
  return parsed.data;
}

/**
 * Jak `validate`, ale przed odpowiedzią 400 `beforeRefusal` może rzucić inny błąd, ważniejszy dla
 * klienta niż błąd pól (duplikat nazwy pozycji, T-060).
 */
export async function validateOr<T extends z.ZodType>(
  schema: T,
  body: unknown,
  beforeRefusal: (fields: Fields) => Promise<void>,
): Promise<z.output<T>> {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  const fields = fieldErrors(parsed.error);
  await beforeRefusal(fields);
  throw new ApiError(400, "validation_failed", fields);
}
