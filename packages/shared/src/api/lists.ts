import { z } from "zod";

/** Nazwa listy 1–100 znaków (F-05). */
export const LIST_NAME_MAX_LENGTH = 100;

/** Treść `POST /api/v1/lists` i `PATCH /api/v1/lists/:listId`. */
export const listNameRequestSchema = z.object({
  name: z
    .string({ error: "required" })
    .trim()
    .min(1, { error: "required" })
    .max(LIST_NAME_MAX_LENGTH, { error: "too_long" })
    // PostgreSQL nie zapisze NUL w kolumnie tekstowej; bez tego INSERT kończy się 500.
    .refine((name) => !name.includes("\u0000"), { error: "invalid" }),
});

export type ListNameRequest = z.input<typeof listNameRequestSchema>;

/** Osoba widoczna na liście: imię bez e-maila (N-02). */
export interface Person {
  id: string;
  name: string;
}

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
  /** Pozycje dochodzą w T-006 (`Item` z api.md). */
  items: never[];
}
