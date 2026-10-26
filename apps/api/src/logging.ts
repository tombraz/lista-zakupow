import { randomUUID } from "node:crypto";
import { LogController, type FastifyBaseLogger, type FastifyServerOptions } from "fastify";
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

export function loggingOptions(settings: LogSettings | undefined) {
  return {
    logger: settings
      ? {
          level: settings.level,
          ...(settings.stream ? { stream: settings.stream } : {}),
          redact: { paths: REDACTED_PATHS, censor: "[REDACTED]" },
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
