import websocket from "@fastify/websocket";
import { LIVE_LIMITS, parseClientMessage, type LiveClientMessage } from "@lista/shared";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type WebSocket from "ws";
import { DomainError } from "../../../domain-error";
import { ApiError, logSecurityEvent } from "../../../http/api-error";
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
  void app.register(websocket, { options: { maxPayload: LIVE_LIMITS.messageBytes } });
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
        if (session) serve(socket, request, session, deps);
        else socket.close(POLICY_VIOLATION);
      },
    );
    done();
  });
}

function serve(
  socket: WebSocket,
  request: FastifyRequest,
  session: LiveSession,
  deps: LiveRouteDeps,
) {
  const { hub } = deps;
  const connection = new WsConnection(socket, session.userId, session.sessionId);
  if (!hub.attach(connection)) {
    socket.close(POLICY_VIOLATION);
    return;
  }
  const beat = heartbeat(socket, connection);
  const budget = new MessageBudget(() => Date.now());
  socket.on("message", (data: Buffer) => {
    if (!budget.take()) {
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
