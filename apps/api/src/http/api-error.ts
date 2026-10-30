import type { ApiErrorBody, DomainErrorCode, ErrorCode } from "@lista/shared";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { DomainError } from "../domain-error";
import { logLimitEvent, securityLog } from "../logging";

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
  duplicate_item: 409,
  own_list: 409,
  already_member: 409,
  invitation_invalid: 410,
  rate_limited: 429,
};

/** Treść odpowiedzi dla błędu domeny (także w treści rejestracji z zaproszeniem). */
export function domainErrorBody(error: DomainError): ApiErrorBody {
  const { limit, listId } = error.details;
  return {
    error: { code: error.code, ...(limit ? { limit } : {}), ...(listId ? { listId } : {}) },
  };
}

export function logSecurityEvent(request: FastifyRequest, error: DomainError): void {
  const { security } = error.details;
  if (!security) return;
  if (security.event === "list_access_denied") {
    const route = request.routeOptions.url;
    securityLog(request.log).warn(
      { event: security.event, route, ...security.ids },
      security.event,
    );
  } else logLimitEvent(request, security.event, security.limit, security.ids);
}

interface ErrorSummary {
  type: string;
  code?: string;
  stack?: string;
  cause?: ErrorSummary;
}

// Komunikat wyjątku może nieść SQL z parametrami (DrizzleQueryError, błąd pg z wartością
// pola), czyli treść użytkownika: do logu tylko typ, kod i ramki stosu (architecture.md, „Logi”).
function summarize(error: unknown): ErrorSummary {
  if (!(error instanceof Error)) return { type: typeof error };
  const code = (error as { code?: unknown }).code;
  const frames = error.stack
    ?.split("\n")
    .filter((line) => /^\s+at /.test(line))
    .join("\n");
  return {
    type: error.constructor.name,
    ...(typeof code === "string" ? { code } : {}),
    ...(frames ? { stack: frames } : {}),
    ...(error.cause === undefined ? {} : { cause: summarize(error.cause) }),
  };
}

function isClientError(error: unknown): boolean {
  const { statusCode } = error as { statusCode?: unknown };
  return typeof statusCode === "number" && statusCode < 500;
}

function isBodyTooLarge(error: unknown): boolean {
  return (error as { code?: unknown }).code === "FST_ERR_CTP_BODY_TOO_LARGE";
}

export function apiErrors(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) return reply.code(error.statusCode).send(error.toBody());
    if (error instanceof DomainError) {
      logSecurityEvent(request, error);
      return reply.code(DOMAIN_STATUS[error.code]).send(domainErrorBody(error));
    }
    // TH-13, TH-21: limit treści (`bodyLimit`) też zostawia zdarzenie w logu `security` (T-034).
    if (isBodyTooLarge(error)) logLimitEvent(request, "limit_reached", "bodyBytes");
    // Błędy klienta z Fastify (np. 413 z limitu treści, zły JSON) obsługuje jego handler.
    if (isClientError(error)) throw error;
    // Domyślny handler wysłałby klientowi `message` wyjątku (np. SQL z parametrami).
    request.log.error({ err: summarize(error) }, "unexpected error");
    const body: ApiErrorBody = { error: { code: "internal", requestId: request.id } };
    return reply.code(500).send(body);
  });
}
