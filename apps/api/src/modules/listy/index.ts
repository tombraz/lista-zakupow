import { drizzle } from "drizzle-orm/node-postgres";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Accounts } from "../konta";
import { requireListAccess, type ListAccess, type RequiredRole } from "./domain/lists";
import { listRoutes } from "./http/routes";
import { DrizzleListsRepository } from "./infra/lists-repository";

export type { ListAccess, ListRole, RequiredRole } from "./domain/lists";

/** Publiczne API modułu: jedyne miejsce sprawdzania dostępu do listy (architecture.md). */
export interface Lists {
  requireListAccess(userId: string, listId: string, required: RequiredRole): Promise<ListAccess>;
}

export function createLists(pool: Pool): Lists {
  return listsApi(new DrizzleListsRepository(drizzle(pool)));
}

/** Trasy `/api/v1/lists*`; zwraca publiczne API modułu dla kolejnych modułów. */
export function listsModule(app: FastifyInstance, pool: Pool, accounts: Accounts): Lists {
  const repository = new DrizzleListsRepository(drizzle(pool));
  listRoutes(app, accounts, repository);
  return listsApi(repository);
}

function listsApi(repository: DrizzleListsRepository): Lists {
  return {
    requireListAccess: (userId, listId, required) =>
      requireListAccess(repository, userId, listId, required),
  };
}
