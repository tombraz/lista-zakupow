import type { ApiErrorBody, ErrorCode } from "@lista/shared";
import type { FastifyInstance } from "fastify";

/** Błąd z kodem z `packages/shared`; jeden handler zamienia go na odpowiedź HTTP. */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    readonly fields?: ApiErrorBody["error"]["fields"],
  ) {
    super(code);
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, ...(this.fields ? { fields: this.fields } : {}) } };
  }
}

export function apiErrors(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.code(error.statusCode).send(error.toBody());
    // Pozostałe (np. 413 z limitu treści) obsługuje domyślny handler Fastify.
    throw error;
  });
}
