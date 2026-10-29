import { ws } from "msw";
import { setupServer } from "msw/node";
import { liveUrl } from "../src/live/liveSocket";

/** `/api/v1/live` w testach komponentów (podstawiony serwer WebSocket przez MSW). */
export const liveLink = ws.link(liveUrl());

// Domyślnie serwer na żywo przyjmuje połączenie i nic nie wysyła (test/live.ts: `liveServer`).
export const server = setupServer(liveLink.addEventListener("connection", () => undefined));
