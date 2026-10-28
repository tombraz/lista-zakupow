import type { ApiErrorBody, DomainErrorCode, ErrorCode } from "@lista/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { DomainError } from "../domain-error";
import { securityLog } from "../logging";

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

// architecture.md, „Konwencje API i błędów”.
const DOMAIN_STATUS: Record<DomainErrorCode, number> = {
  not_found: 404,
  owner_only: 403,
  limit_reached: 409,
};

function domainErrorBody(error: DomainError): ApiErrorBody {
  const { limit } = error.details;
  return { error: { code: error.code, ...(limit ? { limit } : {}) } };
}

function logSecurityEvent(request: FastifyRequest, error: DomainError): void {
  const { security, limit } = error.details;
  if (!security) return;
  securityLog(request.log).warn(
    {
      event: security.event,
      route: request.routeOptions.url,
      ...security.ids,
      ...(limit && { limit }),
    },
    security.event,
  );
}

export function apiErrors(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) return reply.code(error.statusCode).send(error.toBody());
    if (error instanceof DomainError) {
      logSecurityEvent(request, error);
      return reply.code(DOMAIN_STATUS[error.code]).send(domainErrorBody(error));
    }
    // Pozostałe (np. 413 z limitu treści) obsługuje domyślny handler Fastify.
    throw error;
  });
}
