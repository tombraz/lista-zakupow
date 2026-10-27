import { drizzle } from "drizzle-orm/node-postgres";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authRoutes } from "./http/auth-routes";
import { meRoutes } from "./http/me-routes";
import { createAuth, type AuthSettings } from "./infra/auth";
import { SignInFailures } from "./infra/sign-in-failures";

export type { AuthSettings } from "./infra/auth";

export function accountRoutes(app: FastifyInstance, pool: Pool, settings: AuthSettings): void {
  const db = drizzle(pool);
  const auth = createAuth(db, settings, app.log);
  authRoutes(app, { auth, failures: new SignInFailures(db, settings.secret) }, settings.origin);
  meRoutes(app, auth);
}
