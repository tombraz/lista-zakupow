import { drizzle } from "drizzle-orm/node-postgres";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Accounts } from "../konta";
import type { Live } from "../na-zywo";
import { BUSINESS_LIMITS } from "@lista/shared";
import {
  requireJoined,
  requireListAccess,
  type InvitationTarget,
  type ListAccess,
  type ListItems,
  type ListPeople,
  type RequiredRole,
} from "./domain/lists";
import {
  accountDeletionChanges,
  announceAccessChanges,
  renameChanges,
} from "./domain/membership-events";
import { listRoutes } from "./http/routes";
import {
  DrizzleListsRepository,
  insertParticipant,
  listsWithPeopleOf,
  type Transaction,
} from "./infra/lists-repository";

export type {
  InvitationTarget,
  ListAccess,
  ListItems,
  ListPeople,
  ListRole,
  RequiredRole,
} from "./domain/lists";
export { everyone } from "./domain/lists";
export type { AccessChange, ListEvents } from "./domain/membership-events";
/** Jedyne miejsce zdarzeń na żywo po zmianie dostępu do list (TH-04, MC-03, F-14). */
export { announceAccessChanges } from "./domain/membership-events";
export type { Transaction } from "./infra/lists-repository";
/** Blokada wiersza listy w transakcji innego modułu (limity pozycji i linków). */
export { lockList, lockListFor } from "./infra/lists-repository";

/** Publiczne API modułu: jedyne miejsce sprawdzania dostępu do listy (architecture.md). */
export interface Lists {
  requireListAccess(userId: string, listId: string, required: RequiredRole): Promise<ListAccess>;
  /** Nazwa listy i imię właściciela dla podglądu zaproszenia; `null` — lista nie istnieje. */
  invitationTarget(listId: string): Promise<InvitationTarget | null>;
  /** Właściciel i uczestnicy listy: adresaci `lists.changed` (SC-05, F-14). */
  peopleWithAccess(listId: string): Promise<ListPeople | null>;
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
  { items, live }: { items: ListItems; live: Live },
): Lists {
  const db = drizzle(pool);
  const repository = new DrizzleListsRepository(db, items);
  listRoutes(app, accounts, repository, { items, live });
  // F-16: imię widać przy pozycjach i uczestnikach list osoby, więc jej listy odświeżają się.
  accounts.announceNameChanges(async (userId) => {
    await announceAccessChanges(live, renameChanges(await listsWithPeopleOf(db, userId)));
  });
  // F-04: kto traci listy usuwanego konta albo widzi je na swoich — zebrane przed usunięciem.
  accounts.announceAccountDeletions(async (tx, userId) => {
    const lists = await listsWithPeopleOf(tx, userId);
    return () => announceAccessChanges(live, accountDeletionChanges(lists, userId), userId);
  });
  return listsApi(repository);
}

function listsApi(repository: DrizzleListsRepository): Lists {
  return {
    requireListAccess: (userId, listId, required) =>
      requireListAccess(repository, userId, listId, required),
    invitationTarget: (listId) => repository.invitationTarget(listId),
    participantCount: (listId) => repository.participantCount(listId),
    peopleWithAccess: (listId) => repository.peopleWithAccess(listId),
    join: async (transaction, listId, userId) => {
      const limit = BUSINESS_LIMITS.participantsPerList;
      requireJoined(await insertParticipant(transaction, listId, userId, limit), listId, userId);
    },
  };
}
