import {
  signInRequestSchema,
  signUpRequestSchema,
  type ErrorCode,
  type SignUpInvitation,
} from "@lista/shared";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ApiError } from "../../../http/api-error";
import { validate } from "../../../http/validate";
import { logLimitEvent, securityLog } from "../../../logging";
import { passCookies } from "./cookies";
import type { Auth } from "../infra/auth";
import type { SignInFailures } from "../infra/sign-in-failures";

interface AuthDeps {
  auth: Auth;
  failures: SignInFailures;
  /** F-12: przyjęcie zaproszenia zaraz po założeniu konta (podaje moduł `zaproszenia`). */
  invitationOnSignUp: () => InvitationOnSignUp | undefined;
  /** TH-17: po wylogowaniu zamyka połączenia na żywo tej sesji (`na-zywo.closeSession`). */
  onSignedOut: (sessionId: string) => void;
}

/** Przyjmuje zaproszenie dla nowego konta; błąd zaproszenia wraca w treści, nie jako status. */
export type InvitationOnSignUp = (userId: string, token: string) => Promise<SignUpInvitation>;

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
    const { name, email, password, invitationToken } = validate(signUpRequestSchema, request.body);
    const response = await forward(auth, origin, request, { name, email, password });
    if (response.status === 429) logLimitEvent(request, "rate_limited", "signUpPerIp");
    if (await lostEmailRace(auth, response, email)) throw new ApiError(409, "email_taken");
    const accept = deps.invitationOnSignUp();
    if (invitationToken === undefined || !accept) return relay(response, reply);
    return relay(response, reply, async (user) => ({
      invitation: await accept(user.id, invitationToken),
    }));
  });

  app.post("/api/auth/sign-in/email", async (request, reply) => {
    const credentials = validate(signInRequestSchema, request.body);
    const accountKey = failures.accountKey(credentials.email);
    if (!(await failures.reserve(accountKey))) {
      logLimitEvent(request, "rate_limited", "signInFailuresPerAccount", { accountKey });
      throw new ApiError(429, "rate_limited");
    }
    const response = await forward(auth, origin, request, credentials);
    if (response.status === 401) logSecurity(request, "sign_in_failed", { accountKey });
    else await failures.release(accountKey);
    if (response.status === 429) {
      logLimitEvent(request, "rate_limited", "signInPerIp", { accountKey });
    }
    return relay(response, reply);
  });

  app.post("/api/auth/sign-out", async (request, reply) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    const response = await forward(auth, origin, request, {});
    if (response.ok && session) deps.onSignedOut(session.session.id);
    return relay(response, reply);
  });
}

// architecture.md, „Obserwowalność”: zdarzenia bezpieczeństwa tylko z identyfikatorami.
function logSecurity(
  request: FastifyRequest,
  event: "sign_in_failed",
  ids: { accountKey: string },
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

async function relay(
  response: Response,
  reply: FastifyReply,
  extra: (user: AuthUser) => Promise<object> = () => Promise.resolve({}),
) {
  passCookies(response.headers, reply);
  const body = (await response.json().catch(() => ({}))) as { code?: string; user?: AuthUser };
  if (response.ok) {
    const user = body.user;
    if (!user) return reply.send({});
    const account = { id: user.id, name: user.name, email: user.email };
    return reply.send({ user: account, ...(await extra(account)) });
  }
  const known = STATUS_CODES[response.status];
  const [status, code] =
    AUTH_ERRORS[body.code ?? ""] ?? (known ? [response.status, known] : [500, "internal"]);
  throw new ApiError(status, code);
}
