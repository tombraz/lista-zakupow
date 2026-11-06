import type { ApiErrorBody, DomainErrorCode, ErrorCode } from "@lista/shared";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { DomainError } from "../domain-error";
import { errorSummary, logLimitEvent, securityEvent } from "../logging";

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

// architecture.md, „Konwencje API i błędów”; zgodność statusów z tabelą: `test/error-status-docs.test.ts`.
export const DOMAIN_STATUS: Record<DomainErrorCode, number> = {
  not_found: 404,
  owner_only: 403,
  owner_cannot_leave: 403,
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
  if (security.event === "list_access_denied") securityEvent(request, security.event, security.ids);
  else logLimitEvent(request, security.event, security.limit, { ids: security.ids });
}

function isClientError(error: unknown): boolean {
  const { statusCode } = error as { statusCode?: unknown };
  return typeof statusCode === "number" && statusCode < 500;
}

/**
 * Błąd klienta wykryty przez Fastify przed trasą (zły JSON, pusta treść, `content-type`, 413,
 * 414 `maxParamLength`): kody `FST_ERR_*` ze statusem 4xx (T-086).
 */
function isFastifyClientError(error: unknown): error is { statusCode: number } {
  const { code } = error as { code?: unknown };
  return isClientError(error) && typeof code === "string" && code.startsWith("FST_ERR_");
}

function isBodyTooLarge(error: unknown): boolean {
  return (error as { code?: unknown }).code === "FST_ERR_CTP_BODY_TOO_LARGE";
}

/**
 * Opcja `frameworkErrors` Fastify: błędy routera (`FST_ERR_BAD_URL` 400, `FST_ERR_MAX_PARAM_LENGTH`
 * 414) wysyłane z pominięciem `setErrorHandler`; ten sam format co w `apiErrors` (T-086).
 */
export function frameworkErrors(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (isFastifyClientError(error)) {
    const body: ApiErrorBody = { error: { code: "validation_failed" } };
    void reply.code(error.statusCode).send(body);
    return;
  }
  request.log.error({ err: errorSummary(error) }, "unexpected error");
  const body: ApiErrorBody = { error: { code: "internal", requestId: request.id } };
  void reply.code(500).send(body);
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
    // T-086: format błędu API zamiast odpowiedzi Fastify (bez `message` z fragmentem treści);
    // status bez zmian, kod `validation_failed` (decyzja właściciela 2026-11-02).
    if (isFastifyClientError(error)) {
      const body: ApiErrorBody = { error: { code: "validation_failed" } };
      return reply.code(error.statusCode).send(body);
    }
    // Inne błędy klienta ze statusem (np. z wtyczek) obsługuje handler Fastify.
    if (isClientError(error)) throw error;
    // Domyślny handler wysłałby klientowi `message` wyjątku (np. SQL z parametrami).
    request.log.error({ err: errorSummary(error) }, "unexpected error");
    const body: ApiErrorBody = { error: { code: "internal", requestId: request.id } };
    return reply.code(500).send(body);
  });
}
