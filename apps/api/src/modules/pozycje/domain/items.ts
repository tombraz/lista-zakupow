import { BUSINESS_LIMITS, normalizeItemName, type Person } from "@lista/shared";
import type { Clock } from "../../../clock";
import { DomainError } from "../../../domain-error";
import { isUuid } from "../../../ids";
import type { ListAccess } from "../../listy";

/** Pozycja listy (słownik BRD); autor `null` = „usunięty użytkownik” (F-10). */
export interface ListItem {
  id: string;
  name: string;
  note: string | null;
  addedBy: Person | null;
  checkedAt: Date | null;
  checkedBy: Person | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewItem {
  /** `id` od klienta: ponowione żądanie zwraca istniejącą pozycję (F-15). */
  id?: string | undefined;
  listId: string;
  name: string;
  nameKey: string;
  note: string | null;
  addedBy: string;
}

export type InsertResult =
  | { status: "created" | "existing"; item: ListItem }
  /** Lista ma już pozycję o tym `nameKey` (F-09). */
  | { status: "duplicate" }
  /** `id` od klienta należy do pozycji innej listy. */
  | { status: "id_taken" }
  | { status: "limit_reached" };

/** Repozytorium pozycji, którego potrzebuje domena; implementacja w `infra`. */
export interface ItemsRepository {
  /** Nieodhaczone od najnowszej, pod nimi odhaczone od ostatnio odhaczonej (data-model.md). */
  itemsOf(listId: string): Promise<ListItem[]>;
  /** Liczba nieodhaczonych pozycji każdej z podanych list; lista bez nich nie ma wpisu. */
  toBuyCounts(listIds: string[]): Promise<Map<string, number>>;
  /** Nowa pozycja, gdy lista ma mniej niż `limit`; przesuwa listę na początek SC-05. */
  insert(item: NewItem, limit: number): Promise<InsertResult>;
  /**
   * Zmiana pozycji tej listy; `null`, gdy na liście jej nie ma (także usunięta w międzyczasie,
   * F-14), `"duplicate"`, gdy nowy `nameKey` ma inna pozycja (F-09).
   */
  update(
    listId: string,
    itemId: string,
    changes: ItemChanges,
  ): Promise<ListItem | null | "duplicate">;
  /** `false`, gdy na liście nie ma tej pozycji. */
  delete(listId: string, itemId: string): Promise<boolean>;
  /**
   * Odhacza (zapisując aktywność dzienną) albo odznacza pozycję tej listy; ponowne odhaczenie
   * odhaczonej nic nie zmienia. `null`, gdy na liście nie ma tej pozycji.
   */
  check(listId: string, itemId: string, check: ItemCheck): Promise<ListItem | null>;
  /** Usuwa odhaczone pozycje listy; zwraca ich identyfikatory. */
  deleteChecked(listId: string): Promise<string[]>;
}

export interface ItemCheck {
  checked: boolean;
  /** Odhaczający domownik. */
  by: string;
  at: Date;
}

/** Kto i kiedy zmienia pozycję na liście z już sprawdzonym dostępem. */
export interface Actor {
  access: ListAccess;
  userId: string;
  clock: Clock;
}

export interface ItemChanges {
  name?: string;
  nameKey?: string;
  note?: string | null;
}

export interface ItemEdit {
  name?: string | undefined;
  note?: string | null | undefined;
}

export interface ItemInput {
  name: string;
  note: string | null;
}

/** F-07: dodaje domownik z dostępem do listy (sprawdzonym wcześniej). */
export async function addItem(
  repository: ItemsRepository,
  access: ListAccess,
  userId: string,
  input: ItemInput & { id?: string | undefined },
): Promise<{ item: ListItem; created: boolean }> {
  const result = await repository.insert(
    {
      id: input.id,
      listId: access.listId,
      name: input.name,
      nameKey: normalizeItemName(input.name),
      note: input.note,
      addedBy: userId,
    },
    BUSINESS_LIMITS.itemsPerList,
  );
  if (result.status === "limit_reached") {
    throw new DomainError("limit_reached", {
      limit: "items",
      security: { event: "limit_reached", ids: { userId, listId: access.listId } },
    });
  }
  if (result.status === "duplicate") throw new DomainError("duplicate_item");
  // Cudza pozycja wygląda jak nieistniejąca (TH-01).
  if (result.status === "id_taken") throw new DomainError("not_found");
  return { item: result.item, created: result.status === "created" };
}

/**
 * F-07, F-09: zmienia tylko podane pola; ostatni zapis wygrywa (F-14). Pozycja spoza listy
 * z adresu albo już usunięta = `not_found`.
 */
export async function updateItem(
  repository: ItemsRepository,
  access: ListAccess,
  itemId: string,
  input: ItemEdit,
): Promise<ListItem> {
  if (!isUuid(itemId)) throw new DomainError("not_found");
  const { name, note } = input;
  const changes: ItemChanges = {
    ...(name === undefined ? {} : { name, nameKey: normalizeItemName(name) }),
    ...(note === undefined ? {} : { note }),
  };
  const result = await repository.update(access.listId, itemId, changes);
  if (result === "duplicate") throw new DomainError("duplicate_item");
  if (!result) throw new DomainError("not_found");
  return result;
}

/** F-08, F-10: odhaczenie podpisuje pozycję odhaczającym; odznaczenie czyści podpis. */
export async function checkItem(
  repository: ItemsRepository,
  actor: Actor,
  itemId: string,
  checked: boolean,
): Promise<ListItem> {
  const at = actor.clock.now();
  const result = isUuid(itemId)
    ? await repository.check(actor.access.listId, itemId, { checked, by: actor.userId, at })
    : null;
  if (!result) throw new DomainError("not_found");
  return result;
}

/** `PATCH` pozycji: edycja nazwy i notatki, odhaczenie albo jedno i drugie. */
export async function changeItem(
  repository: ItemsRepository,
  actor: Actor,
  itemId: string,
  input: ItemEdit & { checked?: boolean | undefined },
): Promise<ListItem> {
  const { checked, ...edit } = input;
  if (checked === undefined) return updateItem(repository, actor.access, itemId, edit);
  if (edit.name !== undefined || edit.note !== undefined) {
    await updateItem(repository, actor.access, itemId, edit);
  }
  return checkItem(repository, actor, itemId, checked);
}

/** F-07: usunięcie od razu, bez potwierdzenia (SC-06); już usunięta = `not_found`. */
export async function deleteItem(
  repository: ItemsRepository,
  access: ListAccess,
  itemId: string,
): Promise<void> {
  const deleted = isUuid(itemId) && (await repository.delete(access.listId, itemId));
  if (!deleted) throw new DomainError("not_found");
}

/** F-08: „Usuń wszystkie kupione” (po potwierdzeniu w SC-06); nieodhaczone zostają. */
export function clearChecked(repository: ItemsRepository, access: ListAccess): Promise<string[]> {
  return repository.deleteChecked(access.listId);
}
