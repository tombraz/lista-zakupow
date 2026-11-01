import { drizzle } from "drizzle-orm/node-postgres";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import type { Live } from "../na-zywo";
import { authRoutes, type InvitationOnSignUp } from "./http/auth-routes";
import { meRoutes } from "./http/me-routes";
import { requireSession, requireUser } from "./http/require-user";
import { MailDeliveryError, type Mailer } from "./domain/mailer";
import { passwordResetMail } from "./domain/reset-mail";
import { accountKey } from "./infra/account-key";
import { createAuth, type AuthSettings } from "./infra/auth";
import { PasswordResetRequests } from "./infra/password-reset-requests";
import { SignInFailures } from "./infra/sign-in-failures";

export type { AuthSettings } from "./infra/auth";
export type { InvitationOnSignUp } from "./http/auth-routes";
export type { Mail, Mailer } from "./domain/mailer";
export { BrevoMailer } from "./infra/brevo-mailer";
export { MailpitMailer } from "./infra/mailpit-mailer";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

/** Publiczne API modułu dla tras innych modułów (`/api/v1/*`). */
export interface Accounts {
  requireUser(request: FastifyRequest, reply: FastifyReply): Promise<SessionUser>;
  /** Domownik i identyfikator jego sesji (połączenie na żywo zamykane przy wylogowaniu). */
  requireSession(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<{ user: SessionUser; sessionId: string }>;
  /**
   * F-01, F-12: rejestracja z `invitationToken` przyjmuje zaproszenie. Moduł `zaproszenia`
   * zależy od `konta` (sesja), więc podaje obsługę po utworzeniu (odwrócenie zależności).
   */
  acceptInvitationsOnSignUp(accept: InvitationOnSignUp): void;
}

export function accountRoutes(
  app: FastifyInstance,
  pool: Pool,
  settings: AuthSettings,
  { live, mailer }: { live: Pick<Live, "closeSession" | "closeUser">; mailer: Mailer },
): Accounts {
  const db = drizzle(pool);
  const auth = createAuth(db, settings, app.log, (email, token) => {
    // TH-11: wysyłka w tle — czas odpowiedzi nie zdradza, czy konto istnieje. Błąd dostawcy tylko
    // w logu, bez adresu i treści (TH-21); odpowiedź i tak jest ta sama (architecture.md).
    mailer.send(passwordResetMail(settings.origin, email, token)).catch((error: unknown) => {
      app.log.error(
        { source: "mailer", ...deliveryFailure(error) },
        "password reset mail not sent",
      );
    });
  });
  let invitationOnSignUp: InvitationOnSignUp | undefined;
  authRoutes(
    app,
    {
      auth,
      accountKey: (email) => accountKey(settings.secret, email),
      failures: new SignInFailures(db),
      resetRequests: new PasswordResetRequests(db),
      invitationOnSignUp: () => invitationOnSignUp,
      onSignedOut: (sessionId) => {
        live.closeSession(sessionId);
      },
      onPasswordReset: (userId) => {
        live.closeUser(userId);
      },
    },
    settings.origin,
  );
  meRoutes(app, auth);
  return {
    requireUser: (request, reply) => requireUser(auth, request, reply),
    requireSession: (request, reply) => requireSession(auth, request, reply),
    acceptInvitationsOnSignUp: (accept) => {
      invitationOnSignUp = accept;
    },
  };
}

/** Błąd wysyłki do logu: typ i status, nigdy komunikat (bywa z adresem lub treścią, TH-21). */
function deliveryFailure(error: unknown): { error: string; status?: number } {
  if (error instanceof MailDeliveryError) return { error: error.name, status: error.status };
  return { error: error instanceof Error ? error.name : typeof error };
}
