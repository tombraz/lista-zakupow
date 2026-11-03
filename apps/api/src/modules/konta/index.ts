import { drizzle } from "drizzle-orm/node-postgres";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import type { Clock } from "../../clock";
import { deliveryFailure } from "../../logging";
import type { OwnerAlerts } from "../../owner-alerts";
import type { Live } from "../na-zywo";
import { authRoutes, type InvitationOnSignUp } from "./http/auth-routes";
import { meRoutes, type AccountDeleting, type NameChanged } from "./http/me-routes";
import { requireSession, requireUser } from "./http/require-user";
import type { Mailer } from "./domain/mailer";
import { linksNotRevokedAlert } from "./domain/reset-alert";
import { passwordResetMail } from "./domain/reset-mail";
import { accountKey } from "./infra/account-key";
import { createAuth, type AuthSettings, type OnPasswordResetToken } from "./infra/auth";
import { PasswordResetRequests } from "./infra/password-reset-requests";
import { ResetTokens } from "./infra/reset-tokens";
import { isSessionActive } from "./infra/sessions";
import { SignInFailures } from "./infra/sign-in-failures";

export type { AuthSettings } from "./infra/auth";
export type { InvitationOnSignUp } from "./http/auth-routes";
export type { AccountDeleting, NameChanged } from "./http/me-routes";
export type { AccountTransaction } from "./infra/users";
export type { Mail, Mailer } from "./domain/mailer";
export { BrevoMailer } from "./infra/brevo-mailer";
export { MailpitMailer } from "./infra/mailpit-mailer";
export { accountRetention } from "./infra/retention";

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
  /** TH-28: sesja połączenia na żywo nadal istnieje i nie wygasła. */
  sessionActive(sessionId: string): Promise<boolean>;
  /**
   * F-01, F-12: rejestracja z `invitationToken` przyjmuje zaproszenie. Moduł `zaproszenia`
   * zależy od `konta` (sesja), więc podaje obsługę po utworzeniu (odwrócenie zależności).
   */
  acceptInvitationsOnSignUp(accept: InvitationOnSignUp): void;
  /**
   * F-16: po zapisanej zmianie imienia. Listy posiada moduł `listy`, który sam zależy od `konta`,
   * więc podaje rozesłanie zdarzeń po utworzeniu (odwrócenie zależności).
   */
  announceNameChanges(announce: NameChanged): void;
  /**
   * F-04: kto traci dostęp przy usunięciu konta — listy posiada moduł `listy` (odwrócenie
   * zależności jak przy imieniu). Bez podanej obsługi konto i tak znika (kaskady w bazie).
   */
  announceAccountDeletions(announce: AccountDeleting): void;
}

export interface AccountDeps {
  live: Pick<Live, "closeSession" | "closeUser">;
  mailer: Mailer;
  clock: Clock;
  /** N-03: alarmy do właściciela projektu (T-088). */
  ownerAlerts: OwnerAlerts;
}

export function accountRoutes(
  app: FastifyInstance,
  pool: Pool,
  settings: AuthSettings,
  { live, mailer, clock, ownerAlerts }: AccountDeps,
): Accounts {
  const db = drizzle(pool);
  const auth = createAuth(db, settings, app.log, sendResetMail(app, mailer, settings.origin));
  let invitationOnSignUp: InvitationOnSignUp | undefined;
  authRoutes(
    app,
    {
      auth,
      accountKey: (email) => accountKey(settings.secret, email),
      failures: new SignInFailures(db),
      resetRequests: new PasswordResetRequests(db),
      resetTokens: new ResetTokens(db),
      invitationOnSignUp: () => invitationOnSignUp,
      onSignedOut: (sessionId) => {
        live.closeSession(sessionId);
      },
      onPasswordReset: (userId) => {
        live.closeUser(userId);
      },
      onLinksNotRevoked: (userId, errorCode) => {
        ownerAlerts.raise(linksNotRevokedAlert(userId, clock.now(), errorCode));
      },
    },
    settings.origin,
  );
  let nameChanged: NameChanged | undefined;
  let accountDeleting: AccountDeleting | undefined;
  meRoutes(app, {
    auth,
    db,
    nameChanged: (userId) => nameChanged?.(userId),
    accountDeleting: async (tx, userId) =>
      (await accountDeleting?.(tx, userId)) ?? (() => undefined),
    closeUser: (userId) => {
      live.closeUser(userId);
    },
  });
  return {
    requireUser: (request, reply) => requireUser(auth, request, reply),
    requireSession: (request, reply) => requireSession(auth, request, reply),
    sessionActive: (sessionId) => isSessionActive(db, sessionId, new Date()),
    acceptInvitationsOnSignUp: (accept) => {
      invitationOnSignUp = accept;
    },
    announceNameChanges: (announce) => {
      nameChanged = announce;
    },
    announceAccountDeletions: (announce) => {
      accountDeleting = announce;
    },
  };
}

// TH-11: wysyłka w tle — czas odpowiedzi nie zdradza, czy konto istnieje. Błąd dostawcy tylko
// w logu, bez adresu i treści (TH-21); odpowiedź i tak jest ta sama (architecture.md).
function sendResetMail(app: FastifyInstance, mailer: Mailer, origin: string): OnPasswordResetToken {
  return (email, token) => {
    mailer.send(passwordResetMail(origin, email, token)).catch((error: unknown) => {
      app.log.error(
        { source: "mailer", ...deliveryFailure(error) },
        "password reset mail not sent",
      );
    });
  };
}
