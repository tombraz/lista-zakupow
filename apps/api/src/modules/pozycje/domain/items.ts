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
  /** Z zegara aplikacji, jak każda późniejsza zmiana pozycji (api.md: porównanie `updatedAt`). */
  createdAt: Date;
  updatedAt: Date;
}

export type InsertResult =
  | { status: "created" | "existing"; item: ListItem }
  /** Lista ma już pozycję o tym `nameKey` (F-09). */
  | { status: "duplicate" }
  /** `id` od klienta należy do pozycji innej listy. */
  | { status: "id_taken" }
  /** Dodający stracił dostęp do listy przed zapisem (T-119). */
  | { status: "no_access" }
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
   * Zmiana pozycji tej listy przez `by`; `null`, gdy na liście jej nie ma (także usunięta
   * w międzyczasie, F-14) albo `by` nie ma już dostępu do listy (T-119), `"duplicate"`, gdy nowy
   * `nameKey` ma inna pozycja (F-09).
   */
  update(
    listId: string,
    itemId: string,
    changes: ItemChanges,
    stamp: ItemStamp,
  ): Promise<ListItem | null | "duplicate">;
  /** Czy inna niż `exceptItemId` pozycja listy ma ten `nameKey` (F-09). */
  nameKeyTaken(listId: string, nameKey: string, exceptItemId?: string): Promise<boolean>;
  /** `false`, gdy na liście nie ma tej pozycji albo `by` nie ma już dostępu do listy. */
  delete(listId: string, itemId: string, by: string): Promise<boolean>;
  /**
   * Odhacza (zapisując aktywność dzienną) albo odznacza pozycję tej listy; ponowne odhaczenie
   * odhaczonej nic nie zmienia. `null`, gdy na liście nie ma tej pozycji albo odhaczający nie ma
   * już dostępu do listy.
   */
  check(listId: string, itemId: string, check: ItemCheck): Promise<ListItem | null>;
  /** Usuwa odhaczone pozycje listy; zwraca ich identyfikatory, `null` = `by` bez dostępu. */
  deleteChecked(listId: string, by: string): Promise<string[] | null>;
}

/** Kto i kiedy zmienia pozycję. */
export interface ItemStamp {
  at: Date;
  by: string;
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
  { access, userId, clock }: Actor,
  input: ItemInput & { id?: string | undefined },
): Promise<{ item: ListItem; created: boolean }> {
  const at = clock.now();
  const result = await repository.insert(
    {
      id: input.id,
      listId: access.listId,
      name: input.name,
      nameKey: normalizeItemName(input.name),
      note: input.note,
      addedBy: userId,
      createdAt: at,
      updatedAt: at,
    },
    BUSINESS_LIMITS.itemsPerList,
  );
  if (result.status === "limit_reached") {
    throw new DomainError("limit_reached", {
      limit: "items",
      security: {
        event: "limit_reached",
        limit: "itemsPerList",
        ids: { userId, listId: access.listId },
      },
    });
  }
  if (result.status === "duplicate") throw new DomainError("duplicate_item");
  // Cudza pozycja wygląda jak nieistniejąca (TH-01); dostęp utracony w trakcie też (TH-04).
  if (result.status === "id_taken" || result.status === "no_access") {
    throw new DomainError("not_found");
  }
  return { item: result.item, created: result.status === "created" };
}

/**
 * T-060, F-09: nazwa odrzucona za ukryte znaki, której klucz ma już inna pozycja listy, to
 * duplikat (decyzja właściciela 2026-11-01); `exceptItemId` — pozycja, której nazwa się zmienia.
 */
export async function refuseDuplicateName(
  repository: ItemsRepository,
  access: ListAccess,
  name: string,
  exceptItemId?: string,
): Promise<void> {
  const taken = await repository.nameKeyTaken(access.listId, normalizeItemName(name), exceptItemId);
  if (taken) throw new DomainError("duplicate_item");
}

/**
 * F-07, F-09: zmienia tylko podane pola; ostatni zapis wygrywa (F-14). Pozycja spoza listy
 * z adresu albo już usunięta = `not_found`.
 */
export async function updateItem(
  repository: ItemsRepository,
  actor: Actor,
  itemId: string,
  input: ItemEdit,
): Promise<ListItem> {
  if (!isUuid(itemId)) throw new DomainError("not_found");
  const { name, note } = input;
  const changes: ItemChanges = {
    ...(name === undefined ? {} : { name, nameKey: normalizeItemName(name) }),
    ...(note === undefined ? {} : { note }),
  };
  // api.md: `updatedAt` z zegara aplikacji, jak przy odhaczeniu (klient porównuje wersje).
  const { access, clock, userId } = actor;
  const result = await repository.update(access.listId, itemId, changes, {
    at: clock.now(),
    by: userId,
  });
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
  if (checked === undefined) return updateItem(repository, actor, itemId, edit);
  if (edit.name !== undefined || edit.note !== undefined) {
    await updateItem(repository, actor, itemId, edit);
  }
  return checkItem(repository, actor, itemId, checked);
}

/** F-07: usunięcie od razu, bez potwierdzenia (SC-06); już usunięta = `not_found`. */
export async function deleteItem(
  repository: ItemsRepository,
  { access, userId }: Pick<Actor, "access" | "userId">,
  itemId: string,
): Promise<void> {
  const deleted = isUuid(itemId) && (await repository.delete(access.listId, itemId, userId));
  if (!deleted) throw new DomainError("not_found");
}

/** F-08: „Usuń wszystkie kupione” (po potwierdzeniu w SC-06); nieodhaczone zostają. */
export async function clearChecked(
  repository: ItemsRepository,
  { access, userId }: Pick<Actor, "access" | "userId">,
): Promise<string[]> {
  const deleted = await repository.deleteChecked(access.listId, userId);
  if (!deleted) throw new DomainError("not_found");
  return deleted;
}
