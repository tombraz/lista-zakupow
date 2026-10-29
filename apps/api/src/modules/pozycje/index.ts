import type { Item } from "@lista/shared";
import { drizzle } from "drizzle-orm/node-postgres";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Clock } from "../../clock";
import type { Accounts } from "../konta";
import type { Lists } from "../listy";
import type { Live } from "../na-zywo";
import { itemResponse } from "./http/item-response";
import { itemRoutes } from "./http/routes";
import { DrizzleItemsRepository } from "./infra/items-repository";

/** Publiczne API modułu: pozycje listy w kształcie odpowiedzi API (`GET /lists/:listId`). */
export interface Items {
  itemsOf(listId: string): Promise<Item[]>;
  /** Nieodhaczone pozycje per lista (`toBuyCount` w `GET /api/v1/lists`). */
  toBuyCounts(listIds: string[]): Promise<Map<string, number>>;
}

export function createItems(pool: Pool): Items {
  const repository = new DrizzleItemsRepository(drizzle(pool));
  return {
    itemsOf: async (listId) => (await repository.itemsOf(listId)).map(itemResponse),
    toBuyCounts: (listIds) => repository.toBuyCounts(listIds),
  };
}

/** Trasy `/api/v1/lists/:listId/items*`; dostęp do listy sprawdza moduł `listy`. */
export function itemsModule(
  app: FastifyInstance,
  pool: Pool,
  dependencies: { accounts: Accounts; lists: Lists; clock: Clock; live: Live },
) {
  itemRoutes(app, { ...dependencies, repository: new DrizzleItemsRepository(drizzle(pool)) });
}
