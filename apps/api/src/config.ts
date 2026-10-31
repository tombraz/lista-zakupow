import { fileURLToPath } from "node:url";
import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default("127.0.0.1"),
  // ADR 0002: podpis ciasteczek sesji; sekret Fly per aplikacja (deployment.md).
  BETTER_AUTH_SECRET: z.string().min(32),
  // Publiczny adres aplikacji: zaufany Origin i baza ciasteczek (lokalnie Vite). Wymagany:
  // domyślny adres deweloperski na produkcji odrzucałby każde logowanie bez czytelnej przyczyny.
  APP_ORIGIN: z.url(),
  // Adresy / CIDR proxy przed API, po przecinku (Fastify trustProxy); brak = adres z połączenia.
  TRUSTED_PROXIES: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  // src/ i dist/ leżą na tej samej głębokości, więc domyślna ścieżka działa w dev i po buildzie.
  WEB_DIST_DIR: z
    .string()
    .min(1)
    .default(fileURLToPath(new URL("../../web/dist", import.meta.url))),
});

export type Config = z.infer<typeof environmentSchema>;

function blankAsMissing(environment: NodeJS.ProcessEnv) {
  return Object.fromEntries(Object.entries(environment).filter(([, value]) => value !== ""));
}

export function readConfig(environment: NodeJS.ProcessEnv): Config {
  return environmentSchema.parse(blankAsMissing(environment));
}

/** Migracje potrzebują tylko bazy (job CI „migrations”, krok wdrożenia) — bez sekretów API. */
export function readDatabaseUrl(environment: NodeJS.ProcessEnv): string {
  return environmentSchema.pick({ DATABASE_URL: true }).parse(blankAsMissing(environment))
    .DATABASE_URL;
}
