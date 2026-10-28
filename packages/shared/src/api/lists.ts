import { z } from "zod";
import type { Item } from "./items";
import type { Person } from "./person";
import { requiredName } from "./text";

export type { Person };

/** Nazwa listy 1–100 znaków (F-05). */
export const LIST_NAME_MAX_LENGTH = 100;

/** Treść `POST /api/v1/lists` i `PATCH /api/v1/lists/:listId`. */
export const listNameRequestSchema = z.object({ name: requiredName(LIST_NAME_MAX_LENGTH) });

export type ListNameRequest = z.input<typeof listNameRequestSchema>;

/** Rola domownika na liście (słownik BRD: właściciel, uczestnik). */
export type ListRole = "owner" | "participant";

/** Element `GET /api/v1/lists` i odpowiedź utworzenia, zmiany nazwy (api.md, „Listy”). */
export interface ListSummary {
  id: string;
  name: string;
  role: ListRole;
  owner: Person;
  toBuyCount: number;
  /** Uczestnicy bez właściciela, w kolejności dołączenia. */
  members: Person[];
  updatedAt: string;
}

/** `GET /api/v1/lists/:listId`; `members` dla okna usunięcia listy (SC-06). */
export interface ListDetails {
  id: string;
  name: string;
  role: ListRole;
  owner: Person;
  members: Person[];
  /** Nieodhaczone od najnowszej (data-model.md, „Kolejność”). */
  items: Item[];
}
