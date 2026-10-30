import websocket, { type WebsocketPluginOptions } from "@fastify/websocket";
import { LIVE_LIMITS, parseClientMessage, type LiveClientMessage } from "@lista/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type WebSocket from "ws";
import { DomainError } from "../../../domain-error";
import { ApiError, logSecurityEvent } from "../../../http/api-error";
import { logLimitEvent } from "../../../logging";
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
          limitLog(request, session.userId)("limit_reached", "socketsPerSession");
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
  const exceeded = limitLog(request, session.userId);
  if (!hub.attach(connection)) {
    exceeded("limit_reached", "connectionsPerSession");
    socket.close(POLICY_VIOLATION);
    return;
  }
  const beat = heartbeat(socket, connection);
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
      handle(message, connection, request, deps).catch(() => {
        // Np. baza niedostępna: klient nie dostaje potwierdzenia i ponowi po połączeniu.
        request.log.error({ event: "live_message_failed" }, "live message failed");
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
 * osoby, raz na połączenie (kolejne wiadomości po zamknięciu nie zalewają logu; T-033).
 */
function limitLog(request: FastifyRequest, userId: string) {
  let logged = false;
  return (event: "limit_reached" | "rate_limited", limit: keyof typeof LIVE_LIMITS) => {
    if (logged) return;
    logged = true;
    logLimitEvent(request, event, limit, { userId });
  };
}

async function handle(
  message: LiveClientMessage,
  connection: LiveConnection,
  request: FastifyRequest,
  { hub, requireListAccess }: LiveRouteDeps,
) {
  if (message.type === "pong") return;
  const { listId } = message;
  if (message.type === "unsubscribe") {
    hub.unsubscribe(connection, listId);
    return;
  }
  try {
    await requireListAccess(connection.userId, listId);
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    logSecurityEvent(request, error);
    connection.send({ type: "error", code: "not_found", listId });
    return;
  }
  hub.subscribe(connection, listId);
  connection.send({ type: "subscribed", listId });
}
