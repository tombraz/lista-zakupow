import { fieldErrors } from "@lista/shared";
import type { z } from "zod";
import { ApiError } from "./api-error";

/** Treść żądania przez schemat z `packages/shared`; błąd = 400 `validation_failed` z polami. */
export function validate<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "validation_failed", fieldErrors(parsed.error));
  return parsed.data;
}
