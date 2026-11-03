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
  // F-03: dostawca maila resetu. `mailpit` (domyślnie) — HTTP API Mailpita z docker-compose.yml,
  // wymaga MAILPIT_URL; `brevo` (staging, produkcja) — wymaga BREVO_API_KEY (sekret Fly) i
  // MAIL_FROM (zweryfikowany w Brevo adres właściciela; deployment.md). Brak = błąd startu: inaczej
  // reset hasła po cichu by nie działał (T-055 AC3).
  MAILER: z.enum(["mailpit", "brevo"]).default("mailpit"),
  MAILPIT_URL: z.url().optional(),
  BREVO_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.email().optional(),
  // N-03 (T-088): adres alarmów do właściciela projektu (sekret Fly per aplikacja). Wymagany przy
  // `brevo`: bez niego błąd po resecie (linki nieunieważnione) nie dałby znaku poza logiem Fly.
  // Lokalnie opcjonalny — alarm tylko w logu.
  ALERT_EMAIL: z.email().optional(),
  // Adresy / CIDR proxy przed API, po przecinku (Fastify trustProxy); brak = adres z połączenia.
  TRUSTED_PROXIES: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  // src/ i dist/ leżą na tej samej głębokości, więc domyślna ścieżka działa w dev i po buildzie.
  WEB_DIST_DIR: z
    .string()
    .min(1)
    .default(fileURLToPath(new URL("../../web/dist", import.meta.url))),
});

const REQUIRED_FOR_MAILER = {
  mailpit: ["MAILPIT_URL"],
  brevo: ["BREVO_API_KEY", "MAIL_FROM", "ALERT_EMAIL"],
} as const;

export type MailConfig =
  | { provider: "mailpit"; url: string; alertTo?: string }
  | { provider: "brevo"; apiKey: string; sender: string; alertTo: string };

const configSchema = environmentSchema.transform((environment, context) => {
  const { MAILER, MAILPIT_URL, BREVO_API_KEY, MAIL_FROM, ALERT_EMAIL, ...rest } = environment;
  const mail: MailConfig | undefined =
    MAILER === "brevo"
      ? BREVO_API_KEY && MAIL_FROM && ALERT_EMAIL
        ? { provider: MAILER, apiKey: BREVO_API_KEY, sender: MAIL_FROM, alertTo: ALERT_EMAIL }
        : undefined
      : MAILPIT_URL
        ? { provider: MAILER, url: MAILPIT_URL, ...(ALERT_EMAIL ? { alertTo: ALERT_EMAIL } : {}) }
        : undefined;
  if (mail) return { ...rest, mail };
  for (const name of REQUIRED_FOR_MAILER[MAILER].filter((key) => !environment[key])) {
    context.issues.push({
      code: "custom",
      path: [name],
      message: `${name} is required when MAILER=${MAILER}`,
      input: undefined,
    });
  }
  return z.NEVER;
});

export type Config = z.infer<typeof configSchema>;

function blankAsMissing(environment: NodeJS.ProcessEnv) {
  return Object.fromEntries(Object.entries(environment).filter(([, value]) => value !== ""));
}

export function readConfig(environment: NodeJS.ProcessEnv): Config {
  return configSchema.parse(blankAsMissing(environment));
}

/** Migracje potrzebują tylko bazy (job CI „migrations”, krok wdrożenia) — bez sekretów API. */
export function readDatabaseUrl(environment: NodeJS.ProcessEnv): string {
  return environmentSchema.pick({ DATABASE_URL: true }).parse(blankAsMissing(environment))
    .DATABASE_URL;
}
