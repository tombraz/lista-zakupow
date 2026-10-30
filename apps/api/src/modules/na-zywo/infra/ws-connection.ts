import { LIVE_LIMITS, type LiveServerMessage } from "@lista/shared";
import type WebSocket from "ws";
import type { LiveConnection } from "../domain/hub";

/** Połączenie hubu na gnieździe `ws`; zdarzenia jako JSON. */
export class WsConnection implements LiveConnection {
  constructor(
    private readonly socket: WebSocket,
    readonly userId: string,
    readonly sessionId: string,
  ) {}

  get open(): boolean {
    return this.socket.readyState === this.socket.OPEN;
  }

  send(message: LiveServerMessage): void {
    if (this.open) this.socket.send(JSON.stringify(message));
  }

  close(code: number): void {
    this.socket.close(code);
  }
}

/**
 * Bicie serca (architecture.md, „Zmiany na żywo”): `ping` co 25 s; bez `pong` w ciągu 10 s
 * połączenie jest zrywane. Zwraca `pong()` (wołany przy wiadomości klienta) i `stop()`.
 */
export function heartbeat(socket: WebSocket, connection: LiveConnection) {
  let deadline: NodeJS.Timeout | undefined;
  const interval = setInterval(() => {
    connection.send({ type: "ping" });
    deadline ??= setTimeout(() => {
      socket.terminate();
    }, LIVE_LIMITS.pongTimeoutSeconds * 1000);
  }, LIVE_LIMITS.pingIntervalSeconds * 1000);
  return {
    pong: () => {
      clearTimeout(deadline);
      deadline = undefined;
    },
    stop: () => {
      clearInterval(interval);
      clearTimeout(deadline);
    },
  };
}
