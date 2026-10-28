import type { ApiErrorBody, ErrorCode, FieldErrorCode } from "@lista/shared";

export type RequestErrorCode = ErrorCode | "network";

/** Błąd żądania z kodem API (albo `network`); teksty dobiera ekran (CODING_STANDARDS.md). */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: RequestErrorCode,
    readonly fields: Partial<Record<string, FieldErrorCode>> = {},
  ) {
    super(code);
  }
}

/** Każdy błąd żądania jako `ApiRequestError`; nieznany wyjątek to `internal`. */
export function asRequestError(error: unknown): ApiRequestError {
  return error instanceof ApiRequestError ? error : new ApiRequestError(0, "internal");
}

export interface RequestOptions {
  /** Domyślnie POST z treścią, GET bez niej. */
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: object;
}

/** Względne adresy: web i API pod jednym originem (ADR 0006), ciasteczko sesji idzie samo. */
export async function apiRequest<T>(
  path: string,
  { method, body }: RequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: method ?? (body ? "POST" : "GET"),
      credentials: "same-origin",
      ...(body
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
  } catch {
    throw new ApiRequestError(0, "network");
  }
  const json: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = (json as Partial<ApiErrorBody>).error;
    throw new ApiRequestError(response.status, error?.code ?? "internal", error?.fields);
  }
  return json as T;
}
