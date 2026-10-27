import {
  fieldErrors,
  signInRequestSchema,
  signUpRequestSchema,
  type ErrorCode,
} from "@lista/shared";
import type { z } from "zod";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ApiError } from "../../../http/api-error";
import { securityLog } from "../../../logging";
import { passCookies } from "./cookies";
import type { Auth } from "../infra/auth";
import type { SignInFailures } from "../infra/sign-in-failures";

interface AuthDeps {
  auth: Auth;
  failures: SignInFailures;
}

// Kody Better Auth, które klient musi rozróżnić; resztę mapuje sam status HTTP.
const AUTH_ERRORS: Record<string, [status: number, code: ErrorCode]> = {
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: [409, "email_taken"],
  // F-02, TH-11: ten sam kod dla nieznanego e-maila i złego hasła.
  INVALID_EMAIL_OR_PASSWORD: [401, "invalid_credentials"],
};

const STATUS_CODES: Record<number, ErrorCode> = {
  400: "validation_failed",
  401: "unauthenticated",
  403: "invalid_origin",
  429: "rate_limited",
};

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Most do Better Auth (api.md, „Konta”). Udostępnia tylko trasy, których używa klient;
 * odpowiedzi w formacie API, bez tokenu sesji w treści (TH-16).
 */
export function authRoutes(app: FastifyInstance, deps: AuthDeps, origin: string): void {
  const { auth, failures } = deps;
  app.post("/api/auth/sign-up/email", async (request, reply) => {
    const { name, email, password } = validate(signUpRequestSchema, request.body);
    const response = await forward(auth, origin, request, { name, email, password });
    if (response.status === 429) logSecurity(request, "rate_limited", {});
    if (await lostEmailRace(auth, response, email)) throw new ApiError(409, "email_taken");
    return relay(response, reply);
  });

  app.post("/api/auth/sign-in/email", async (request, reply) => {
    const credentials = validate(signInRequestSchema, request.body);
    const accountKey = failures.accountKey(credentials.email);
    if (!(await failures.reserve(accountKey))) {
      logSecurity(request, "rate_limited", { accountKey });
      throw new ApiError(429, "rate_limited");
    }
    const response = await forward(auth, origin, request, credentials);
    if (response.status === 401) logSecurity(request, "sign_in_failed", { accountKey });
    else await failures.release(accountKey);
    if (response.status === 429) logSecurity(request, "rate_limited", { accountKey });
    return relay(response, reply);
  });

  app.post("/api/auth/sign-out", async (request, reply) => {
    const response = await forward(auth, origin, request, {});
    return relay(response, reply);
  });
}

// architecture.md, „Obserwowalność”: zdarzenia bezpieczeństwa tylko z identyfikatorami.
function logSecurity(
  request: FastifyRequest,
  event: "sign_in_failed" | "rate_limited",
  ids: { accountKey?: string },
) {
  securityLog(request.log).warn({ event, route: request.url, ...ids }, event);
}

/**
 * Dwie równoczesne rejestracje tego samego e-maila mijają sprawdzenie Better Auth; druga
 * odbija się od unikalności w bazie z ogólnym `FAILED_TO_CREATE_USER`. Wtedy e-mail jest zajęty.
 */
async function lostEmailRace(auth: Auth, response: Response, email: string): Promise<boolean> {
  if (response.status !== 422) return false;
  const body = (await response.clone().json()) as { code?: string };
  if (body.code !== "FAILED_TO_CREATE_USER") return false;
  const { internalAdapter } = await auth.$context;
  return (await internalAdapter.findUserByEmail(email.toLowerCase())) !== null;
}

function validate<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "validation_failed", fieldErrors(parsed.error));
  return parsed.data;
}

function forward(auth: Auth, origin: string, request: FastifyRequest, body: object) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined && name !== "content-length") headers.set(name, String(value));
  }
  headers.set("content-type", "application/json");
  // Limity per IP: adres z połączenia (lub zaufanego proxy), nigdy nagłówek od klienta.
  headers.set("x-forwarded-for", request.ip);
  return auth.handler(
    new Request(new URL(request.url, origin), {
      method: request.method,
      headers,
      body: JSON.stringify(body),
    }),
  );
}

async function relay(response: Response, reply: FastifyReply) {
  passCookies(response.headers, reply);
  const body = (await response.json().catch(() => ({}))) as { code?: string; user?: AuthUser };
  if (response.ok) {
    const user = body.user;
    return reply.send(user ? { user: { id: user.id, name: user.name, email: user.email } } : {});
  }
  const known = STATUS_CODES[response.status];
  const [status, code] =
    AUTH_ERRORS[body.code ?? ""] ?? (known ? [response.status, known] : [500, "internal"]);
  throw new ApiError(status, code);
}
