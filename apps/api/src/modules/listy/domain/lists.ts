import { BUSINESS_LIMITS, type Item, type ListRole, type Person } from "@lista/shared";
import { DomainError } from "../../../domain-error";
import { isUuid } from "../../../ids";

export type { ListRole, Person };

/** Wymagany poziom dostępu: dowolny (odczyt, pozycje) albo właściciel (nazwa, usunięcie). */
export type RequiredRole = "member" | "owner";

export interface ListAccess {
  listId: string;
  role: ListRole;
}

export interface ShoppingList {
  id: string;
  name: string;
  owner: Person;
  /** Uczestnicy bez właściciela, w kolejności dołączenia. */
  members: Person[];
  toBuyCount: number;
  updatedAt: Date;
}

/** Lista widziana przez konkretnego domownika: z jego rolą. */
export interface ListView extends ShoppingList {
  role: ListRole;
}

/** Kto ma dostęp do listy (identyfikatory domowników). */
export interface ListPeople {
  ownerId: string;
  participantIds: string[];
}

/** Wszyscy z dostępem: właściciel i uczestnicy. */
export function everyone(people: ListPeople | null): string[] {
  return people ? [people.ownerId, ...people.participantIds] : [];
}

/** Lista widziana z linku zaproszenia (SC-08): tylko nazwa i imię właściciela (MC-02). */
export interface InvitationTarget {
  listName: string;
  ownerName: string;
}

/** Repozytorium list, którego potrzebuje domena; implementacja w `infra`. */
export interface ListsRepository {
  /** Rola domownika na liście albo `null`, gdy lista nie istnieje lub nie ma do niej dostępu. */
  roleOf(userId: string, listId: string): Promise<ListRole | null>;
  /** Nowa lista albo `null`, gdy właściciel ma już `limit` własnych list. */
  insertWithinLimit(ownerId: string, name: string, limit: number): Promise<string | null>;
  /** Zmiana nazwy przesuwa listę na początek (`updated_at`). */
  rename(listId: string, name: string): Promise<void>;
  delete(listId: string): Promise<void>;
  /** Listy z dostępem domownika (własne i udostępnione), od ostatnio zmienionej. */
  listsOf(userId: string, listId?: string): Promise<ShoppingList[]>;
  invitationTarget(listId: string): Promise<InvitationTarget | null>;
  /** Właściciel i uczestnicy listy; `null`, gdy lista nie istnieje. */
  peopleWithAccess(listId: string): Promise<ListPeople | null>;
  participantCount(listId: string): Promise<number>;
}

/** Wynik dopisania uczestnika do listy (F-12). */
export type JoinOutcome = "joined" | "own_list" | "already_member" | "limit_reached";

/**
 * F-12: tylko „joined” dopisuje uczestnika. Domownik z dostępem dostaje identyfikator listy
 * (SC-08 „Otwórz listę”); przy limicie 20 lista nie jest ujawniana.
 */
export function requireJoined(outcome: JoinOutcome, listId: string, userId: string): void {
  if (outcome === "joined") return;
  if (outcome === "limit_reached") {
    throw new DomainError("limit_reached", {
      limit: "participants",
      security: { event: "limit_reached", ids: { userId, listId } },
    });
  }
  throw new DomainError(outcome, { listId });
}

/**
 * Pozycje listy dla jej szczegółów. Posiada je moduł `pozycje`, który sam zależy od `listy`
 * (dostęp), więc implementację podaje `app.ts` (odwrócenie zależności, CODING_STANDARDS.md).
 */
export interface ListItems {
  itemsOf(listId: string): Promise<Item[]>;
  /** Liczba nieodhaczonych pozycji każdej z list (SC-05 „N do kupienia”); brak = 0. */
  toBuyCounts(listIds: string[]): Promise<Map<string, number>>;
}

/**
 * Jedyne miejsce sprawdzania dostępu do listy (TH-01, TH-02). Cudza lista daje ten sam
 * `not_found` co nieistniejąca (MC-01).
 */
export async function requireListAccess(
  repository: ListsRepository,
  userId: string,
  listId: string,
  required: RequiredRole,
): Promise<ListAccess> {
  const valid = isUuid(listId);
  const role = valid ? await repository.roleOf(userId, listId) : null;
  // Do logu tylko identyfikatory; dowolny tekst z adresu zostaje poza logiem.
  const security = { event: "list_access_denied", ids: valid ? { userId, listId } : { userId } };
  if (!role) throw new DomainError("not_found", { security });
  if (required === "owner" && role !== "owner") throw new DomainError("owner_only", { security });
  return { listId, role };
}

function viewOf(userId: string, list: ShoppingList): ListView {
  return { ...list, role: list.owner.id === userId ? "owner" : "participant" };
}

export async function listsOf(repository: ListsRepository, userId: string): Promise<ListView[]> {
  const lists = await repository.listsOf(userId);
  return lists.map((list) => viewOf(userId, list));
}

/** Jedna lista, do której dostęp jest już sprawdzony. */
export async function listOf(
  repository: ListsRepository,
  userId: string,
  access: ListAccess,
): Promise<ListView> {
  const [list] = await repository.listsOf(userId, access.listId);
  if (!list) throw new DomainError("not_found");
  return viewOf(userId, list);
}

/** F-05: tworzący zostaje właścicielem; limit liczy tylko własne listy. */
export async function createList(
  repository: ListsRepository,
  ownerId: string,
  name: string,
): Promise<ListView> {
  const listId = await repository.insertWithinLimit(ownerId, name, BUSINESS_LIMITS.listsPerOwner);
  if (!listId) {
    throw new DomainError("limit_reached", {
      limit: "lists",
      security: { event: "limit_reached", ids: { userId: ownerId } },
    });
  }
  return listOf(repository, ownerId, { listId, role: "owner" });
}

/** F-05: tylko właściciel (dostęp sprawdzony z rolą `owner`). */
export async function renameList(
  repository: ListsRepository,
  userId: string,
  access: ListAccess,
  name: string,
): Promise<ListView> {
  await repository.rename(access.listId, name);
  return listOf(repository, userId, access);
}

/** F-05: tylko właściciel; członkostwa (później pozycje i zaproszenia) znikają kaskadą. */
export async function deleteList(repository: ListsRepository, access: ListAccess): Promise<void> {
  await repository.delete(access.listId);
}
