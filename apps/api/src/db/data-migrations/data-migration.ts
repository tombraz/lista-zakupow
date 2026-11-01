import type { PoolClient } from "pg";

/**
 * Krok migracji danych, który liczy wartości kodem z `packages/shared` (tech-stack.md, T-060).
 * `run` dostaje połączenie w otwartej transakcji i zwraca podsumowanie do logu migracji.
 */
export interface DataMigration {
  readonly name: string;
  run(client: PoolClient): Promise<string>;
}
