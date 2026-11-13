import websocket, { type WebsocketPluginOptions } from "@fastify/websocket";
import { LIVE_LIMITS, parseClientMessage, type LiveClientMessage } from "@lista/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type WebSocket from "ws";
import { DomainError } from "../../../domain-error";
import { ApiError, logSecurityEvent } from "../../../http/api-error";
import { logFailure, logLimitEvent } from "../../../logging";
import { POLICY_VIOLATION, type LiveConnection, type LiveHub } from "../domain/hub";
import { MessageBudget } from "../domain/message-budget";
import { heartbeat, WsConnection } from "../infra/ws-connection";

/** Sesja żądania upgrade (podaje moduł `konta`). */
export interface LiveSession {
  userId: string;
  sessionId: string;
}

export interface LiveRouteDeps {
  hub: LiveHub;
  /** Zaufany origin aplikacji web (TH-14). */
  origin: string;
  /** Sesja z ciasteczka albo 401 (`konta`); nigdy z adresu (TH-16). */
  sessionOf: (request: FastifyRequest, reply: FastifyReply) => Promise<LiveSession>;
  /** TH-28: sesja połączenia nadal istnieje i nie wygasła (`konta`). */
  sessionActive: (sessionId: string) => Promise<boolean>;
  /** `requireListAccess` modułu `listy`; brak dostępu = `DomainError("not_found")`. */
  requireListAccess: (userId: string, listId: string) => Promise<void>;
}

/** `GET /api/v1/live` → WebSocket (api.md, „Zmiany na żywo”). */
export function liveRoutes(app: FastifyInstance, deps: LiveRouteDeps): void {
  const sessions = new WeakMap<FastifyRequest, LiveSession>();
  const sockets = new SocketsPerSession();
  // `closeTimeout` ma `ws` 8.22; @types/ws 8.18 jeszcze go nie zna.
  const options: NonNullable<WebsocketPluginOptions["options"]> & { closeTimeout: number } = {
    maxPayload: LIVE_LIMITS.messageBytes,
    closeTimeout: LIVE_LIMITS.closeTimeoutSeconds * 1000,
  };
  void app.register(websocket, { options });
  void app.register((scope, _options, done) => {
    scope.get(
      "/api/v1/live",
      {
        websocket: true,
        preValidation: async (request, reply) => {
          // TH-14 (CSWSH): przeglądarka zawsze wysyła Origin przy upgrade WebSocket.
          if (request.headers.origin !== deps.origin) throw new ApiError(403, "invalid_origin");
          sessions.set(request, await deps.sessionOf(request, reply));
        },
      },
      (socket, request) => {
        const session = sessions.get(request);
        if (!session) socket.close(POLICY_VIOLATION);
        else if (!sockets.hold(socket, session.sessionId)) {
          limitLog(request, session)("limit_reached", "socketsPerSession");
          // Bez wymiany ramek close: zerwane gniazdo nie czeka na klienta (`closeTimeout`).
          socket.terminate();
        } else serve(socket, request, session, deps);
      },
    );
    done();
  });
}

/**
 * TH-25: gniazda sesji do zamknięcia TCP (`close` w `ws`), także odrzucone 1008 i zamykane —
 * klient bez FIN trzyma je do `closeTimeout`; `connectionsPerSession` liczy tylko otwarte (T-037).
 */
class SocketsPerSession {
  private readonly counts = new Map<string, number>();

  /** `false`, gdy sesja ma już komplet gniazd; wtedy gniazda nie liczy. */
  hold(socket: WebSocket, sessionId: string): boolean {
    const count = this.counts.get(sessionId) ?? 0;
    if (count >= LIVE_LIMITS.socketsPerSession) return false;
    this.counts.set(sessionId, count + 1);
    socket.once("close", () => {
      const left = (this.counts.get(sessionId) ?? 1) - 1;
      if (left > 0) this.counts.set(sessionId, left);
      else this.counts.delete(sessionId);
    });
    return true;
  }
}

function serve(
  socket: WebSocket,
  request: FastifyRequest,
  session: LiveSession,
  deps: LiveRouteDeps,
) {
  const { hub } = deps;
  const connection = new WsConnection(socket, session.userId, session.sessionId);
  const exceeded = limitLog(request, session);
  if (!hub.attach(connection)) {
    exceeded("limit_reached", "connectionsPerSession");
    socket.close(POLICY_VIOLATION);
    return;
  }
  const beat = heartbeat(socket, connection, sessionCheck(deps, connection, request));
  const budget = new MessageBudget(() => Date.now());
  // `ws` zamyka 1009 po wiadomości ponad `maxPayload` i zgłasza to jako błąd gniazda.
  socket.on("error", (error: Error & { code?: string }) => {
    if (error.code === "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH")
      exceeded("limit_reached", "messageBytes");
  });
  socket.on("message", (data: Buffer) => {
    if (!budget.take()) {
      exceeded("rate_limited", "messagesPerSecond");
      socket.close(POLICY_VIOLATION);
      return;
    }
    beat.pong();
    const message = parseClientMessage(data.toString("utf8"));
    if (!message) connection.send({ type: "error", code: "validation_failed" });
    else {
      handle(message, connection, request, deps).catch((error: unknown) => {
        // Np. baza niedostępna: klient nie dostaje potwierdzenia i ponowi po połączeniu.
        logFailure(request.log, "live_message_failed", error);
      });
    }
  });
  socket.on("close", () => {
    beat.stop();
    hub.detach(connection);
  });
}

/**
 * TH-21, TH-25: przekroczenie limitu połączenia trafia do logu `security` z identyfikatorem
 * osoby, raz na sesję i limit w oknie (`LimitLogWindow` w `logLimitEvent`, T-038) — kolejne
 * wiadomości po zamknięciu nie zalewają logu (T-033), a inny limit tego połączenia ma własny
 * wpis (T-041).
 */
function limitLog(request: FastifyRequest, session: LiveSession) {
  return (event: "limit_reached" | "rate_limited", limit: keyof typeof LIVE_LIMITS) => {
    logLimitEvent(request, event, limit, {
      ids: { userId: session.userId },
      subject: session.sessionId,
    });
  };
}

async function handle(
  message: LiveClientMessage,
  connection: LiveConnection,
  request: FastifyRequest,
  { hub, sessionActive, requireListAccess }: LiveRouteDeps,
) {
  if (message.type === "pong") return;
  const { listId } = message;
  if (message.type === "unsubscribe") {
    hub.unsubscribe(connection, listId);
    return;
  }
  // TH-28: sesja mogła wygasnąć albo zniknąć z bazy od otwarcia połączenia.
  if (!(await sessionActive(connection.sessionId))) {
    endConnection(hub, connection);
    return;
  }
  const pending = hub.requestSubscription(connection, listId);
  try {
    await requireListAccess(connection.userId, listId);
  } catch (error) {
    pending.cancel();
    if (!(error instanceof DomainError)) throw error;
    logSecurityEvent(request, error);
    connection.send({ type: "error", code: "not_found", listId });
    return;
  }
  // `revoke` w trakcie sprawdzenia: dostęp odczytany sprzed usunięcia członkostwa (MC-03).
  connection.send(
    pending.confirm()
      ? { type: "subscribed", listId }
      : { type: "error", code: "not_found", listId },
  );
}

/**
 * TH-28: okresowa kontrola sesji przy pingu, w tle — wolna baza nie wstrzymuje pingów innych
 * połączeń; najwyżej jedno zapytanie naraz na połączenie (AC2 T-056).
 */
function sessionCheck(
  { hub, sessionActive }: LiveRouteDeps,
  connection: LiveConnection,
  request: FastifyRequest,
) {
  let checking = false;
  return () => {
    if (checking) return;
    checking = true;
    sessionActive(connection.sessionId)
      .then((active) => {
        if (!active) endConnection(hub, connection);
      })
      .catch((error: unknown) => {
        // Baza niedostępna: połączenie zostaje, kolejna kontrola przy następnym pingu.
        logFailure(request.log, "live_session_check_failed", error);
      })
      .finally(() => {
        checking = false;
      });
  };
}

/** Sesja się skończyła: bez dalszych zdarzeń od razu, zamknięcie 1008 jak przy wylogowaniu. */
function endConnection(hub: LiveHub, connection: LiveConnection): void {
  hub.detach(connection);
  connection.close(POLICY_VIOLATION);
}
