import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

interface Received {
  method: string | undefined;
  path: string | undefined;
  headers: IncomingMessage["headers"];
  body: unknown;
}

/** Brevo podstawione lokalnie (granica systemu): zapisuje żądania, odpowiada `respond`. */
export async function fakeBrevo(
  respond: (response: ServerResponse) => void = (r) => r.writeHead(201).end("{}"),
) {
  const received: Received[] = [];
  let started = 0;
  const server = createServer((request, response) => {
    started += 1;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      received.push({
        method: request.method,
        path: request.url,
        headers: request.headers,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
      });
      respond(response);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    received,
    started: () => started,
    stop: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}
