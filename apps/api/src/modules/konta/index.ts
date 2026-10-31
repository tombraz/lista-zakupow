import { drizzle } from "drizzle-orm/node-postgres";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import type { Live } from "../na-zywo";
import { authRoutes, type InvitationOnSignUp } from "./http/auth-routes";
import { meRoutes } from "./http/me-routes";
import { requireSession, requireUser } from "./http/require-user";
import { createAuth, type AuthSettings } from "./infra/auth";
import { SignInFailures } from "./infra/sign-in-failures";

export type { AuthSettings } from "./infra/auth";
export type { InvitationOnSignUp } from "./http/auth-routes";

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
  live: Pick<Live, "closeSession">,
): Accounts {
  const db = drizzle(pool);
  const auth = createAuth(db, settings, app.log);
  let invitationOnSignUp: InvitationOnSignUp | undefined;
  const failures = new SignInFailures(db, settings.secret);
  authRoutes(
    app,
    {
      auth,
      failures,
      invitationOnSignUp: () => invitationOnSignUp,
      onSignedOut: (sessionId) => {
        live.closeSession(sessionId);
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
