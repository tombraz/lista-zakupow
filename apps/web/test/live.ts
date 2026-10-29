import type { LiveServerMessage } from "@lista/shared";
import { liveLink, server } from "./msw-server";

type Client = Parameters<
  Parameters<typeof liveLink.addEventListener<"connection">>[1]
>[0]["client"];

/** Serwer na żywo testu: zapisuje wiadomości klienta, wysyła zdarzenia, zrywa połączenia. */
export function liveServer() {
  const clients: Client[] = [];
  const open = new Set<Client>();
  const received: unknown[] = [];
  server.use(
    liveLink.addEventListener("connection", ({ client }) => {
      clients.push(client);
      open.add(client);
      client.addEventListener("message", (event) => {
        received.push(JSON.parse(typeof event.data === "string" ? event.data : "null"));
      });
      client.addEventListener("close", () => {
        open.delete(client);
      });
    }),
  );
  return {
    /** Wiadomości klienta → serwer (bez `pong`). */
    received: () => received.filter((message) => (message as { type: string }).type !== "pong"),
    /** Wszystkie wiadomości klienta, także `pong`. */
    receivedAll: () => [...received],
    connections: () => clients.length,
    send(message: LiveServerMessage) {
      for (const client of open) client.send(JSON.stringify(message));
    },
    /** Serwer zamyka wszystkie połączenia (np. restart API). */
    dropAll() {
      for (const client of open) client.close();
    },
  };
}
