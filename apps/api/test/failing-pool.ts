import type { Pool } from "pg";

type Query = (...args: unknown[]) => Promise<unknown>;

/**
 * Pula, w której pasujące zapytania wysłane przez `pool.query` kończą się błędem bazy (bez
 * wysyłania do bazy); reszta, w tym transakcje na kliencie z `connect()`, idzie do prawdziwej.
 */
export function failingPool(pool: Pool, matches: RegExp): Pool {
  const query = pool.query.bind(pool) as Query;
  const failing: Query = (...args) =>
    matches.test(sqlOf(args[0]))
      ? Promise.reject(Object.assign(new Error("connection terminated"), { code: "57P01" }))
      : query(...args);
  return new Proxy(pool, {
    get(target, property) {
      if (property === "query") return failing;
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === "function" ? (value as Query).bind(target) : value;
    },
  });
}

function sqlOf(config: unknown): string {
  if (typeof config === "string") return config;
  if (typeof config === "object" && config !== null && "text" in config) {
    return String(config.text);
  }
  return "";
}
