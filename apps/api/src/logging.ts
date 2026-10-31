import { randomUUID } from "node:crypto";
import { LIVE_LIMITS, type LimitKey } from "@lista/shared";
import {
  LogController,
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";
import type { DestinationStream } from "pino";
import type { Clock } from "./clock";

declare module "fastify" {
  interface FastifyInstance {
    /** Okno zdarzeń limitu w logu `security` (`limitLogWindow`), jedno na aplikację. */
    limitLogWindow: LimitLogWindow;
  }
}

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
// Dopasowanie na zdekodowanej ścieżce, nie na surowej: router dekoduje ścieżkę, więc
// `/%61pi/v1/invitations/<token>` trafia do trasy z tokenem (TH-26, T-051).
const INVITATION_TOKEN_PATH = /^(\/api\/v1\/invitations\/|\/zaproszenie\/)[^/]+/;

// Tylko znaki ASCII: wystarczą do rozpoznania prefiksu, a dekodowanie nie rzuca wyjątku
// przy nieprawidłowej sekwencji `%` (serializer logu działa też dla żądań odrzuconych przez router).
// Bez `%2F`: router nie dzieli po nim ścieżki, więc `A%2F<token>` to jeden segment z tokenem.
const ASCII_ESCAPE = /%(?!2f)([0-7][0-9a-f])/gi;

// TH-16: token sesji nigdy nie jest czytany z adresu, ale klient może go tam dopisać
// (np. `/api/v1/live?token=…`); wartość parametru z „token” w nazwie nie trafia do logu.
const TOKEN_QUERY_PARAMETER = /([?&][^=&#]*token[^=&#]*=)[^&#]*/gi;

function decodedAscii(text: string): string {
  return text.replace(ASCII_ESCAPE, (_escape, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

/**
 * Ścieżka żądania bez tokenu zaproszenia (`/api/v1/invitations/[redacted]/accept`,
 * `/zaproszenie/[redacted]`) i bez wartości parametrów z tokenem (`?token=[redacted]`).
 * Ścieżka z tokenem trafia do logu zdekodowana, w każdym zapisie w tej samej postaci.
 */
export function redactedUrl(url: string): string {
  const queryStart = url.search(/[?#]/);
  const path = queryStart === -1 ? url : url.slice(0, queryStart);
  const query = queryStart === -1 ? "" : url.slice(queryStart);
  const decoded = decodedAscii(path).replace(/\/{2,}/g, "/");
  const loggedPath = INVITATION_TOKEN_PATH.test(decoded)
    ? decoded.replace(INVITATION_TOKEN_PATH, "$1[redacted]")
    : path;
  return loggedPath + query.replace(TOKEN_QUERY_PARAMETER, "$1[redacted]");
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

/** `route` zdarzenia w logu `security`, gdy żądanie nie trafiło w żadną trasę (T-035). */
export const UNKNOWN_ROUTE = "(unknown)";

/** Zdarzenia bezpieczeństwa (architecture.md, „Obserwowalność”): tylko identyfikatory. */
export function securityLog(log: FastifyBaseLogger): FastifyBaseLogger {
  return log.child({ channel: "security" });
}

/**
 * TH-21: jedyne miejsce kształtu zdarzenia w logu `security` (T-041): `route` to wzorzec trasy
 * (`UNKNOWN_ROUTE` dla nieznanej), nigdy surowy adres z query; `fields` tylko identyfikatory.
 */
export function securityEvent(
  request: FastifyRequest,
  event: string,
  fields: Record<string, string> = {},
): void {
  const route = request.routeOptions.url ?? UNKNOWN_ROUTE;
  securityLog(request.log).warn({ event, ...fields, route }, event);
}

/**
 * TH-21: najwyżej jedno zdarzenie na podmiot i limit w oknie `limitLogWindowSeconds` — kolejne
 * próby ponad limit nie zalewają logu `security` (T-038, T-040). Klucz (np. z adresem IP) zostaje
 * w pamięci; wygasłe okna sprząta przy zapisie, więc mapa ma najwyżej tyle wpisów, ile zdarzeń
 * zapisano w ostatnim oknie.
 */
export class LimitLogWindow {
  private readonly until = new Map<string, number>();

  constructor(private readonly clock: Clock) {}

  /** `true`, gdy zdarzenie trzeba zapisać; wtedy otwiera okno dla podmiotu i limitu. */
  take(subject: string, limit: LimitKey): boolean {
    const now = this.clock.now().getTime();
    const key = `${limit}:${subject}`;
    if ((this.until.get(key) ?? 0) > now) return false;
    for (const [open, end] of this.until) if (end <= now) this.until.delete(open);
    this.until.set(key, now + LIVE_LIMITS.limitLogWindowSeconds * 1000);
    return true;
  }
}

export function limitLogWindow(app: FastifyInstance, clock: Clock): void {
  app.decorate("limitLogWindow", new LimitLogWindow(clock));
}

/**
 * TH-21: zdarzenie przekroczenia limitu (T-035) przez `securityEvent` (T-041): `limit` to klucz
 * stałej z `packages/shared/src/limits.ts`, `ids` tylko identyfikatory.
 * `subject` — kto przekracza limit (okno `LimitLogWindow`): domyślnie identyfikatory, bez nich
 * adres IP; nie trafia do logu.
 */
export function logLimitEvent(
  request: FastifyRequest,
  event: "limit_reached" | "rate_limited",
  limit: LimitKey,
  { ids = {}, subject }: { ids?: Record<string, string>; subject?: string } = {},
): void {
  subject ??= Object.values(ids).join(":") || request.ip;
  if (!request.server.limitLogWindow.take(subject, limit)) return;
  securityEvent(request, event, { ...ids, limit });
}
