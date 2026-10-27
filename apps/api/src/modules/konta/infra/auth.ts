import { RATE_LIMITS, TERMS_VERSION, type RateLimit } from "@lista/shared";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { FastifyBaseLogger } from "fastify";
import * as schema from "../../../db/schema";

export interface AuthSettings {
  secret: string;
  /** Publiczny adres aplikacji (web i API pod jednym originem, ADR 0006). */
  origin: string;
}

const DAY_SECONDS = 24 * 60 * 60;

// ADR 0002: sesje w bazie, 30 dni bez użycia, przedłużane przy użyciu.
export function createAuth(db: NodePgDatabase, settings: AuthSettings, log: FastifyBaseLogger) {
  return betterAuth({
    secret: settings.secret,
    baseURL: settings.origin,
    basePath: "/api/auth",
    trustedOrigins: [settings.origin],
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true },
    // MC-04, MC-05: limity per IP w bazie; IP klienta ustawia most Fastify (auth-routes.ts).
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-in/email": rule(RATE_LIMITS.signInPerIp),
        "/sign-up/email": rule(RATE_LIMITS.signUpPerIp),
      },
    },
    session: { expiresIn: 30 * DAY_SECONDS, updateAge: DAY_SECONDS },
    user: {
      additionalFields: {
        termsAcceptedAt: { type: "date", required: false, input: false },
        termsVersion: { type: "string", required: false, input: false },
        ageConfirmedAt: { type: "date", required: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Zgody sprawdził już schemat rejestracji; jedyna droga do utworzenia konta (F-01).
          before: (user) => {
            const now = new Date();
            return Promise.resolve({
              data: {
                ...user,
                termsAcceptedAt: now,
                termsVersion: TERMS_VERSION,
                ageConfirmedAt: now,
              },
            });
          },
        },
      },
    },
    advanced: {
      // Bez wyjątku dla środowiska testowego: testy sprawdzają to samo, co działa w produkcji.
      disableOriginCheck: false,
    },
    // N-02: bez wysyłania danych do zewnętrznych usług.
    telemetry: { enabled: false },
    // TH-21: komunikaty Better Auth bywają z e-mailem (np. przy zajętym adresie) — tylko błędy.
    logger: {
      level: "error",
      log: (level, message) => {
        log[level]({ source: "better-auth" }, message);
      },
    },
  });
}

function rule(limit: RateLimit) {
  return { window: limit.windowSeconds, max: limit.max };
}

export type Auth = ReturnType<typeof createAuth>;
