import {
  passwordResetRequestSchema,
  passwordResetSchema,
  signInRequestSchema,
  signUpRequestSchema,
  type ErrorCode,
  type SignUpInvitation,
} from "@lista/shared";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ApiError } from "../../../http/api-error";
import { perIp, perIpRateLimit } from "../../../http/rate-limit";
import { validate } from "../../../http/validate";
import { errorSummary, logLimitEvent, securityEvent } from "../../../logging";
import { passCookies } from "./cookies";
import type { Auth } from "../infra/auth";
import type { PasswordResetRequests } from "../infra/password-reset-requests";
import type { ResetTokens } from "../infra/reset-tokens";
import type { SignInFailures } from "../infra/sign-in-failures";

interface AuthDeps {
  auth: Auth;
  /** Pseudonim e-maila do liczników i logu `security` (TH-21). */
  accountKey: (email: string) => string;
  failures: SignInFailures;
  resetRequests: PasswordResetRequests;
  /** F-03, TH-10: resety konta po kolei, po udanym reszta linków konta przestaje działać. */
  resetTokens: ResetTokens;
  /** F-12: przyjęcie zaproszenia zaraz po założeniu konta (podaje moduł `zaproszenia`). */
  invitationOnSignUp: () => InvitationOnSignUp | undefined;
  /** TH-17: po wylogowaniu zamyka połączenia na żywo tej sesji (`na-zywo.closeSession`). */
  onSignedOut: (sessionId: string) => void;
  /** TH-28: reset usunął wszystkie sesje konta; zamyka ich połączenia na żywo (`na-zywo`). */
  onPasswordReset: (userId: string) => void;
}

/** Przyjmuje zaproszenie dla nowego konta; błąd zaproszenia wraca w treści, nie jako status. */
export type InvitationOnSignUp = (userId: string, token: string) => Promise<SignUpInvitation>;

// Kody Better Auth, które klient musi rozróżnić; resztę mapuje sam status HTTP.
const AUTH_ERRORS: Record<string, [status: number, code: ErrorCode]> = {
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: [409, "email_taken"],
  // F-02, TH-11: ten sam kod dla nieznanego e-maila i złego hasła.
  INVALID_EMAIL_OR_PASSWORD: [401, "invalid_credentials"],
  // F-03: link resetu użyty, wygasły, nieznany albo konta usuniętego w międzyczasie.
  INVALID_TOKEN: [400, "invalid_token"],
  USER_NOT_FOUND: [400, "invalid_token"],
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
  const { auth, failures, resetRequests } = deps;
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

  // TH-27: limit per IP przed licznikiem konta, bo `reserve()` pisze do bazy. Limit Better Auth
  // (w bazie) zostaje za nim jako druga linia, np. po restarcie API (licznik Fastify w pamięci).
  void app.register(async (scope) => {
    await perIpRateLimit(scope);
    scope.post("/api/auth/sign-in/email", perIp("signInPerIp"), async (request, reply) => {
      const credentials = validate(signInRequestSchema, request.body);
      const accountKey = deps.accountKey(credentials.email);
      if (!(await failures.reserve(accountKey))) {
        logLimitEvent(request, "rate_limited", "signInFailuresPerAccount", {
          ids: { accountKey },
        });
        throw new ApiError(429, "rate_limited");
      }
      const response = await forward(auth, origin, request, credentials);
      if (response.status === 401) logSecurity(request, "sign_in_failed", { accountKey });
      else await failures.release(accountKey);
      if (response.status === 429) {
        // Podmiot to IP, nie konto: seria kont z jednego IP to jedno zdarzenie w oknie.
        logLimitEvent(request, "rate_limited", "signInPerIp", {
          ids: { accountKey },
          subject: request.ip,
        });
      }
      return relay(response, reply);
    });

    // F-03: 200 zawsze (TH-11); mail wysyła `sendResetPassword` w tle. TH-27: limit per IP
    // (w pamięci) przed licznikiem e-maila, który pisze do bazy.
    scope.post(
      "/api/auth/request-password-reset",
      perIp("passwordResetPerIp"),
      async (request, reply) => {
        const { email } = validate(passwordResetRequestSchema, request.body);
        const accountKey = deps.accountKey(email);
        if (!(await resetRequests.take(accountKey))) {
          logLimitEvent(request, "rate_limited", "passwordResetPerEmail", { ids: { accountKey } });
          throw new ApiError(429, "rate_limited");
        }
        const response = await forward(auth, origin, request, { email });
        if (response.status === 429) logLimitEvent(request, "rate_limited", "passwordResetPerIp");
        return relay(response, reply);
      },
    );
  });

  newPasswordRoute(app, deps, origin);

  app.post("/api/auth/sign-out", async (request, reply) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    const response = await forward(auth, origin, request, {});
    if (response.ok && session) deps.onSignedOut(session.session.id);
    return relay(response, reply);
  });
}

/** F-03: nowe hasło z linku resetu; TH-10 / TH-28: koniec sesji konta i ich połączeń na żywo. */
function newPasswordRoute(app: FastifyInstance, deps: AuthDeps, origin: string): void {
  const { auth } = deps;
  app.post("/api/auth/reset-password", async (request, reply) => {
    const body = validate(passwordResetSchema, request.body);
    // Właściciel tokenu przed jego zużyciem: po sukcesie wiadomo, czyje sesje usunął Better Auth.
    const userId = await resetTokenOwner(auth, body.token);
    const response = userId
      ? await deps.resetTokens.exclusive(userId, async () => {
          const result = await forward(auth, origin, request, body);
          if (result.ok) await revokeOtherLinks(request, deps.resetTokens, userId);
          return result;
        })
      : await forward(auth, origin, request, body);
    if (response.ok && userId) {
      logSecurity(request, "password_reset", { userId });
      deps.onPasswordReset(userId);
    }
    return relay(response, reply);
  });
}

/**
 * T-087: hasło już zmienione i sesje usunięte (transakcja Better Auth), więc błąd sprzątania
 * pozostałych linków nie może przerwać logu `password_reset` ani zamknięcia połączeń (TH-28).
 * Linki i tak wygasają po 1 h (F-03); błąd tylko w logu, bez tokenów (TH-21).
 */
async function revokeOtherLinks(request: FastifyRequest, tokens: ResetTokens, userId: string) {
  try {
    await tokens.revokeAll(userId);
  } catch (error) {
    request.log.error(
      { event: "reset_tokens_revoke_failed", userId, err: errorSummary(error) },
      "revoking reset links failed",
    );
  }
}

// architecture.md, „Obserwowalność”: zdarzenia bezpieczeństwa tylko z identyfikatorami.
function logSecurity(
  request: FastifyRequest,
  event: "sign_in_failed" | "password_reset",
  ids: { accountKey: string } | { userId: string },
) {
  securityEvent(request, event, ids);
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

/** Konto, dla którego wydano token resetu (`verification` Better Auth), albo `null`. */
async function resetTokenOwner(auth: Auth, token: string): Promise<string | null> {
  const { internalAdapter } = await auth.$context;
  const verification = await internalAdapter.findVerificationValue(`reset-password:${token}`);
  return verification?.value ?? null;
}

function forward(auth: Auth, origin: string, request: FastifyRequest, body: object) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined && name !== "content-length") headers.set(name, String(value));
  }
  headers.set("content-type", "application/json");
  // Limity per IP: adres z połączenia (lub zaufanego proxy), nigdy nagłówek od klienta.
  headers.set("x-forwarded-for", request.ip);
  // TH-26: Better Auth dostaje wzorzec dopasowanej trasy, nie surowy zapis ścieżki od klienta.
  return auth.handler(
    new Request(new URL(request.routeOptions.url ?? "", origin), {
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
