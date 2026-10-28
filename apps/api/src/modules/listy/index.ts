import { drizzle } from "drizzle-orm/node-postgres";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Accounts } from "../konta";
import { BUSINESS_LIMITS } from "@lista/shared";
import {
  requireJoined,
  requireListAccess,
  type InvitationTarget,
  type ListAccess,
  type ListItems,
  type RequiredRole,
} from "./domain/lists";
import { listRoutes } from "./http/routes";
import {
  DrizzleListsRepository,
  insertParticipant,
  type Transaction,
} from "./infra/lists-repository";

export type {
  InvitationTarget,
  ListAccess,
  ListItems,
  ListRole,
  RequiredRole,
} from "./domain/lists";
export type { Transaction } from "./infra/lists-repository";
/** Blokada wiersza listy w transakcji innego modułu (limity pozycji i linków). */
export { lockList } from "./infra/lists-repository";

/** Publiczne API modułu: jedyne miejsce sprawdzania dostępu do listy (architecture.md). */
export interface Lists {
  requireListAccess(userId: string, listId: string, required: RequiredRole): Promise<ListAccess>;
  /** Nazwa listy i imię właściciela dla podglądu zaproszenia; `null` — lista nie istnieje. */
  invitationTarget(listId: string): Promise<InvitationTarget | null>;
  /** Liczba uczestników bez właściciela (limit 20, F-12). */
  participantCount(listId: string): Promise<number>;
  /**
   * F-12: dopisuje uczestnika w transakcji wołającego albo rzuca `own_list`, `already_member`,
   * `limit_reached` (wołający wycofuje transakcję).
   */
  join(transaction: Transaction, listId: string, userId: string): Promise<void>;
}

export function createLists(pool: Pool, items: ListItems): Lists {
  return listsApi(new DrizzleListsRepository(drizzle(pool), items));
}

/** Trasy `/api/v1/lists*`; zwraca publiczne API modułu dla kolejnych modułów. */
export function listsModule(
  app: FastifyInstance,
  pool: Pool,
  accounts: Accounts,
  items: ListItems,
): Lists {
  const repository = new DrizzleListsRepository(drizzle(pool), items);
  listRoutes(app, accounts, repository, items);
  return listsApi(repository);
}

function listsApi(repository: DrizzleListsRepository): Lists {
  return {
    requireListAccess: (userId, listId, required) =>
      requireListAccess(repository, userId, listId, required),
    invitationTarget: (listId) => repository.invitationTarget(listId),
    participantCount: (listId) => repository.participantCount(listId),
    join: async (transaction, listId, userId) => {
      const limit = BUSINESS_LIMITS.participantsPerList;
      requireJoined(await insertParticipant(transaction, listId, userId, limit), listId, userId);
    },
  };
}
