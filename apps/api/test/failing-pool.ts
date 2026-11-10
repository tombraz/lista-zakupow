import type { Pool } from "pg";
import { sqlOf, withQuery, type Query } from "./gated-pool";

/**
 * Pula, w której pasujące zapytania wysłane przez `pool.query` kończą się błędem bazy (bez
 * wysyłania do bazy); reszta idzie do prawdziwej. Transakcje na kliencie z `connect()` idą do
 * prawdziwej bazy, chyba że `clients: true` — wtedy pasujące zapytanie w transakcji też pada
 * i Drizzle ją wycofuje (T-118).
 */
export function failingPool(
  pool: Pool,
  matches: RegExp,
  { clients = false }: { clients?: boolean } = {},
): Pool {
  const failing =
    (query: Query): Query =>
    (...args) =>
      matches.test(sqlOf(args[0]))
        ? Promise.reject(Object.assign(new Error("connection terminated"), { code: "57P01" }))
        : query(...args);
  return withQuery(pool, failing(pool.query.bind(pool) as Query), (client) =>
    clients ? withQuery(client, failing(client.query.bind(client) as Query)) : client,
  );
}
