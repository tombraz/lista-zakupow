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

function open(url: string, { cookie, origin = TEST_ORIGIN, query = "" }: UpgradeOptions) {
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
