import { randomUUID } from "node:crypto";
import {
  LogController,
  type FastifyBaseLogger,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
import type { DestinationStream } from "pino";

export interface LogSettings {
  level: string;
  stream?: DestinationStream;
}

// TH-21: logi bez sekretów i danych logowania; wartości zastępowane, klucze zostają.
const REDACTED_PATHS = [
  "password",
  "token",
  "*.password",
  "*.token",
  "*.*.password",
  "*.*.token",
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
];

// TH-08: token zaproszenia w ścieżce to uprawnienie do listy; do logu tylko jego miejsce.
// Dwie ścieżki niosą token: API (podgląd, przyjęcie) i strona SC-08 serwowana przez API (ADR 0006).
const INVITATION_TOKEN_PATH = /^(\/api\/v1\/invitations\/|\/zaproszenie\/)[^/?#]+/;

// TH-16: token sesji nigdy nie jest czytany z adresu, ale klient może go tam dopisać
// (np. `/api/v1/live?token=…`); wartość parametru z „token” w nazwie nie trafia do logu.
const TOKEN_QUERY_PARAMETER = /([?&][^=&#]*token[^=&#]*=)[^&#]*/gi;

/**
 * Ścieżka żądania bez tokenu zaproszenia (`/api/v1/invitations/[redacted]/accept`,
 * `/zaproszenie/[redacted]`) i bez wartości parametrów z tokenem (`?token=[redacted]`).
 */
export function redactedUrl(url: string): string {
  return url
    .replace(INVITATION_TOKEN_PATH, "$1[redacted]")
    .replace(TOKEN_QUERY_PARAMETER, "$1[redacted]");
}

interface LoggedRequest {
  [key: string]: unknown;
  method?: string;
  url?: string;
  host?: string;
  remoteAddress?: string;
  remotePort?: number;
}

// Jak domyślny serializer Fastify, ale z `redactedUrl`. `Partial`: pino stosuje go do każdego
// pola `req` w logu, nie tylko do żądania Fastify.
function serializeRequest(request: FastifyRequest): LoggedRequest {
  const raw: Partial<FastifyRequest> = request;
  const logged: LoggedRequest = {};
  if (raw.method !== undefined) logged.method = raw.method;
  if (raw.url !== undefined) logged.url = redactedUrl(raw.url);
  if (raw.host !== undefined) logged.host = raw.host;
  if (raw.ip !== undefined) logged.remoteAddress = raw.ip;
  const port = raw.socket?.remotePort;
  if (port !== undefined) logged.remotePort = port;
  return logged;
}

export function loggingOptions(settings: LogSettings | undefined) {
  return {
    logger: settings
      ? {
          level: settings.level,
          ...(settings.stream ? { stream: settings.stream } : {}),
          redact: { paths: REDACTED_PATHS, censor: "[REDACTED]" },
          serializers: { req: serializeRequest },
        }
      : false,
    logController: new LogController({ requestIdLogLabel: "requestId" }),
    genReqId: () => randomUUID(),
  } satisfies FastifyServerOptions;
}

/** Zdarzenia bezpieczeństwa (architecture.md, „Obserwowalność”): tylko identyfikatory. */
export function securityLog(log: FastifyBaseLogger): FastifyBaseLogger {
  return log.child({ channel: "security" });
}
