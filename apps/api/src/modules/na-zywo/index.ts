import type { FastifyInstance } from "fastify";
import { LiveHub } from "./domain/hub";
import { liveRoutes, type LiveRouteDeps } from "./http/routes";

export type { Live } from "./domain/hub";
export type { LiveSession } from "./http/routes";

/** Hub zmian na żywo jednej instancji API (ADR 0003); tworzony przed modułami, które publikują. */
export function createLiveHub(): LiveHub {
  return new LiveHub();
}

/** WebSocket `/api/v1/live`; sesję i dostęp do listy podaje `app.ts` (moduły `konta`, `listy`). */
export function liveModule(app: FastifyInstance, deps: LiveRouteDeps): void {
  liveRoutes(app, deps);
}
