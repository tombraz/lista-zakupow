import { randomBytes } from "node:crypto";
import { connect as tcpConnect } from "node:net";
import type { FastifyInstance } from "fastify";
import WebSocket from "ws";
import type { LiveServerMessage } from "@lista/shared";
import { TEST_ORIGIN } from "./app";

// Testy bicia serca podstawiają zegar (vi.useFakeTimers); oczekiwanie klienta biegnie w czasie rzeczywistym.
const wait = globalThis.setTimeout.bind(globalThis);
const stopWaiting = globalThis.clearTimeout.bind(globalThis);

/** Adres `/api/v1/live` aplikacji uruchomionej na losowym porcie (prawdziwy upgrade WS). */
export async function liveUrl(app: FastifyInstance): Promise<string> {
  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  return `${address.replace("http", "ws")}/api/v1/live`;
}

export interface UpgradeOptions {
  cookie?: string;
  origin?: string | null;
  /** Dopisane do adresu, np. `?token=…` (TH-16). */
  query?: string;
}

/** Status HTTP odrzuconego upgrade'u albo `101`, gdy połączenie się otworzyło. */
export function upgradeStatus(url: string, options: UpgradeOptions = {}): Promise<number> {
  const socket = open(url, options);
  return new Promise((resolve, reject) => {
    socket.once("unexpected-response", (_request, response) => {
      resolve(response.statusCode ?? 0);
      socket.terminate();
    });
    socket.once("open", () => {
      resolve(101);
      socket.close();
    });
    socket.once("error", (error) => {
      // Po odrzuceniu `ws` zgłasza też błąd gniazda; wynik jest już znany.
      if (!error.message.includes("Unexpected server response")) reject(error);
    });
  });
}

/** Kod zamknięcia połączenia, także zerwanego tuż po upgrade (wtedy `1006`, bez `open`). */
export function closeCode(
  url: string,
  options: UpgradeOptions = {},
  timeoutMs = 1000,
): Promise<number> {
  const socket = open(url, options);
  socket.on("error", () => {
    // Zerwane gniazdo: `ws` zgłasza błąd, a potem `close` z kodem 1006.
  });
  return new Promise((resolve, reject) => {
    const timer = wait(() => {
      socket.terminate();
      reject(new Error("connection still open"));
    }, timeoutMs);
    socket.once("close", (code) => {
      stopWaiting(timer);
      resolve(code);
    });
  });
}

function open(url: string,{ cookie, origin = TEST_ORIGIN, query = "" }: UpgradeOptions) {
  const headers: Record<string, string> = {};
  if (cookie) headers["cookie"] = cookie;
  return new WebSocket(`${url}${query}`, { headers, ...(origin ? { origin } : {}) });
}

type MessageOf<T extends LiveServerMessage["type"]> = Extract<LiveServerMessage, { type: T }>;

/** Klient WS z kolejką odebranych wiadomości (bez `ping`, chyba że `keepPings`). */
export interface LiveClient {
  socket: WebSocket;
  send(message: unknown): void;
  /** Następna wiadomość danego typu (wcześniejsze innych typów zostają w kolejce). */
  next<T extends LiveServerMessage["type"]>(type: T, timeoutMs?: number): Promise<MessageOf<T>>;
  /** Wszystkie wiadomości odebrane do tej pory. */
  received(): LiveServerMessage[];
  /** W kolejce nie ma i przez `ms` nie przyszła żadna nieodebrana wiadomość. */
  expectSilence(ms?: number): Promise<void>;
  /** Kod zamknięcia połączenia przez serwer. */
  closed(timeoutMs?: number): Promise<number>;
  close(): void;
}

export async function connectLive(
  url: string,
  options: UpgradeOptions & { keepPings?: boolean } = {},
): Promise<LiveClient> {
  const socket = open(url, options);
  const queue: LiveServerMessage[] = [];
  const all: LiveServerMessage[] = [];
  const waiters = new Set<() => void>();
  const closeCode = new Promise<number>((resolve) => {
    socket.once("close", (code) => {
      resolve(code);
    });
  });
  socket.on("message", (data: Buffer) => {
    const message = JSON.parse(data.toString("utf8")) as LiveServerMessage;
    if (message.type === "ping" && !options.keepPings) return;
    queue.push(message);
    all.push(message);
    for (const wake of waiters) wake();
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => {
      resolve();
    });
    socket.once("error", reject);
  });

  const take = <T extends LiveServerMessage["type"]>(type: T) => {
    const index = queue.findIndex((message) => message.type === type);
    return index === -1 ? undefined : (queue.splice(index, 1)[0] as MessageOf<T>);
  };

  return {
    socket,
    send: (message) => {
      socket.send(typeof message === "string" ? message : JSON.stringify(message));
    },
    next: (type, timeoutMs = 1000) =>
      new Promise((resolve, reject) => {
        const found = take(type);
        if (found) {
          resolve(found);
          return;
        }
        const timer = wait(() => {
          waiters.delete(check);
          reject(
            new Error(`no "${type}" within ${String(timeoutMs)} ms; got ${JSON.stringify(all)}`),
          );
        }, timeoutMs);
        function check() {
          const message = take(type);
          if (!message) return;
          stopWaiting(timer);
          waiters.delete(check);
          resolve(message);
        }
        waiters.add(check);
      }),
    received: () => [...all],
    expectSilence: async (ms = 300) => {
      await new Promise((resolve) => wait(resolve, ms));
      if (queue.length > 0) throw new Error(`unexpected messages: ${JSON.stringify(queue)}`);
    },
    closed: (timeoutMs = 1000) =>
      Promise.race([
        closeCode,
        new Promise<number>((_, reject) =>
          wait(() => {
            reject(new Error("connection still open"));
          }, timeoutMs),
        ),
      ]),
    close: () => {
      socket.close();
    },
  };
}

/** Pauza w czasie rzeczywistym (także przy podstawionym zegarze), np. na dotarcie wiadomości. */
export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => wait(resolve, ms));
}

/**
 * Połączenie, które kończy zamknięcie WebSocket (ramka close w obie strony), ale nie zamyka TCP —
 * jak klient, którego FIN jeszcze nie dotarł do serwera (T-036). Zwraca zerwanie gniazda.
 */
export async function closeWithoutFin(
  url: string,
  { cookie, origin = TEST_ORIGIN }: UpgradeOptions,
): Promise<() => void> {
  const { hostname, port, pathname } = new URL(url);
  const socket = tcpConnect({ host: hostname, port: Number(port), allowHalfOpen: true });
  const headers = [
    `GET ${pathname} HTTP/1.1`,
    `Host: ${hostname}:${port}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Key: ${randomBytes(16).toString("base64")}`,
    "Sec-WebSocket-Version: 13",
    ...(origin ? [`Origin: ${origin}`] : []),
    ...(cookie ? [`Cookie: ${cookie}`] : []),
  ];
  const end = "\r\n\r\n";
  socket.write(`${headers.join("\r\n")}${end}`);
  let received = Buffer.alloc(0);
  const until = (done: (data: Buffer) => boolean) =>
    new Promise<void>((resolve, reject) => {
      const check = () => {
        if (!done(received)) return;
        socket.off("data", onData);
        resolve();
      };
      const onData = (chunk: Buffer) => {
        received = Buffer.concat([received, chunk]);
        check();
      };
      socket.on("data", onData);
      socket.once("error", reject);
      check();
    });
  await until((data) => data.includes(end));
  const head = received.toString("latin1");
  if (!head.startsWith("HTTP/1.1 101")) throw new Error(`upgrade failed: ${head.slice(0, 40)}`);
  received = received.subarray(head.indexOf(end) + end.length);
  // Ramka close klienta (maskowana), kod 1000.
  const mask = randomBytes(4);
  const code = [0x03, 0xe8].map((byte, i) => byte ^ (mask[i] ?? 0));
  socket.write(Buffer.from([0x88, 0x82, ...mask, ...code]));
  await until((data) => data[0] === 0x88);
  return () => socket.destroy();
}
