import { BUSINESS_LIMITS, normalizeItemName, type Person } from "@lista/shared";
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
  /** Nieodhaczone od najnowszej (data-model.md, „Kolejność”). */
  itemsOf(listId: string): Promise<ListItem[]>;
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
}

export interface ItemChanges {
  name?: string;
  nameKey?: string;
  note?: string | null;
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
  input: { name?: string | undefined; note?: string | null | undefined },
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

/** F-07: usunięcie od razu, bez potwierdzenia (SC-06); już usunięta = `not_found`. */
export async function deleteItem(
  repository: ItemsRepository,
  access: ListAccess,
  itemId: string,
): Promise<void> {
  const deleted = isUuid(itemId) && (await repository.delete(access.listId, itemId));
  if (!deleted) throw new DomainError("not_found");
}
