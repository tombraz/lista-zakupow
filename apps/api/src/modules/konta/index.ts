import { drizzle } from "drizzle-orm/node-postgres";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { authRoutes, type InvitationOnSignUp } from "./http/auth-routes";
import { meRoutes } from "./http/me-routes";
import { requireUser } from "./http/require-user";
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
  /**
   * F-01, F-12: rejestracja z `invitationToken` przyjmuje zaproszenie. Moduł `zaproszenia`
   * zależy od `konta` (sesja), więc podaje obsługę po utworzeniu (odwrócenie zależności).
   */
  acceptInvitationsOnSignUp(accept: InvitationOnSignUp): void;
}

export function accountRoutes(app: FastifyInstance, pool: Pool, settings: AuthSettings): Accounts {
  const db = drizzle(pool);
  const auth = createAuth(db, settings, app.log);
  let invitationOnSignUp: InvitationOnSignUp | undefined;
  const failures = new SignInFailures(db, settings.secret);
  authRoutes(
    app,
    { auth, failures, invitationOnSignUp: () => invitationOnSignUp },
    settings.origin,
  );
  meRoutes(app, auth);
  return {
    requireUser: (request, reply) => requireUser(auth, request, reply),
    acceptInvitationsOnSignUp: (accept) => {
      invitationOnSignUp = accept;
    },
  };
}
