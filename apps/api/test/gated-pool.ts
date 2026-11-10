import type { Pool, PoolClient } from "pg";

// Testy z vi.useFakeTimers: limit oczekiwania biegnie w czasie rzeczywistym.
const wait = globalThis.setTimeout.bind(globalThis);
const stopWaiting = globalThis.clearTimeout.bind(globalThis);

export type Query = (...args: unknown[]) => Promise<unknown>;

export interface GatedPool {
  /** Pula dla `buildTestApp`; poza `query` zachowuje się jak prawdziwa. */
  pool: Pool;
  /** Od teraz wynik pasującego zapytania czeka na `release()` (zapytanie już się wykonało). */
  hold(): void;
  release(): void;
  /** Spełnia się, gdy `count` pasujących wyników czeka na `release()`; inaczej błąd po `timeoutMs`. */
  held(count: number, timeoutMs?: number): Promise<void>;
  /** Pasujące zapytania wysłane do bazy od utworzenia puli. */
  queries(): number;
  /** Pasujące zapytania, których wynik oddano już wywołującemu. */
  answered(): number;
}

/**
 * Pula, która wstrzymuje dostarczenie wyniku pasujących zapytań, dopóki test go nie puści —
 * wyścig „odczyt z bazy przed zmianą, wynik po niej” bez `sleep` (T-056). Baza jest prawdziwa.
 * `clients: true` wstrzymuje też zapytania na klientach z `connect()` (transakcje Drizzle):
 * zapytanie w transakcji się wykonało, a transakcja czeka niezatwierdzona (T-118).
 */
export function gatedPool(
  pool: Pool,
  matches: RegExp,
  { clients = false }: { clients?: boolean } = {},
): GatedPool {
  let gate: Promise<void> | undefined;
  let open: () => void = () => undefined;
  let waiting = 0;
  let sent = 0;
  let delivered = 0;
  const watchers = new Set<() => void>();
  const gated =
    (query: Query): Query =>
    async (...args) => {
      if (!matches.test(sqlOf(args[0]))) return query(...args);
      sent += 1;
      const result = await query(...args);
      const until = gate;
      if (until) {
        waiting += 1;
        for (const watch of watchers) watch();
        await until;
        waiting -= 1;
      }
      delivered += 1;
      return result;
    };

  const proxy = withQuery(pool, gated(pool.query.bind(pool) as Query), (client) =>
    clients ? withQuery(client, gated(client.query.bind(client) as Query)) : client,
  );

  return {
    pool: proxy,
    hold: () => {
      gate = new Promise((resolve) => {
        open = resolve;
      });
    },
    release: () => {
      gate = undefined;
      open();
    },
    held: (count, timeoutMs = 1000) =>
      new Promise((resolve, reject) => {
        const timer = wait(() => {
          watchers.delete(watch);
          reject(new Error(`${String(waiting)} of ${String(count)} results held`));
        }, timeoutMs);
        function watch() {
          if (waiting < count) return;
          stopWaiting(timer);
          watchers.delete(watch);
          resolve();
        }
        watchers.add(watch);
        watch();
      }),
    queries: () => sent,
    answered: () => delivered,
  };
}

/** `target` z podmienionym `query`; `connect()` oddaje klienta przez `wrapClient`. */
export function withQuery<T extends object>(
  target: T,
  query: Query,
  wrapClient: (client: PoolClient) => PoolClient = (client) => client,
): T {
  const connect = async (): Promise<PoolClient> =>
    wrapClient(await (target as unknown as Pool).connect());
  return new Proxy(target, {
    get(object, property) {
      if (property === "query") return query;
      if (property === "connect" && "connect" in object) return connect;
      const value: unknown = Reflect.get(object, property, object);
      return typeof value === "function" ? (value as Query).bind(object) : value;
    },
  });
}

export function sqlOf(config: unknown): string {
  if (typeof config === "string") return config;
  if (typeof config === "object" && config !== null && "text" in config) {
    return String(config.text);
  }
  return "";
}
