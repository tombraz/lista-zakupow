import pg from "pg";

// Neon nalicza za czas, gdy baza nie śpi: bezczynne połączenia zamykamy po 30 s (deployment.md).
const IDLE_TIMEOUT_MS = 30_000;
const CONNECTION_TIMEOUT_MS = 3_000;
/** Migracje przy wdrożeniu czekają, aż uśpiona baza Neon się wybudzi (T-010). */
export const MIGRATION_CONNECTION_TIMEOUT_MS = 30_000;

export interface PoolOptions {
  connectionTimeoutMillis?: number;
}

export function createPool(connectionString: string, options: PoolOptions = {}): pg.Pool {
  return new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? CONNECTION_TIMEOUT_MS,
    idle_in_transaction_session_timeout: IDLE_TIMEOUT_MS,
  });
}
