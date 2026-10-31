import { z } from "zod";
import type { Person } from "./person";
import { requiredName, withoutNul } from "./text";

/** Nazwa pozycji 1–100 znaków, ilość / notatka do 200 (F-07). */
export const ITEM_NAME_MAX_LENGTH = 100;
export const ITEM_NOTE_MAX_LENGTH = 200;

/**
 * Klucz porównania nazw pozycji (F-09, ADR 0004): `item.name_key` w bazie i lokalne sprawdzenie
 * w klientach. Jedyne miejsce tej reguły; jej zmiana wymaga migracji przeliczającej klucze.
 */
export function normalizeItemName(name: string): string {
  return name.trim().normalize("NFC").toLocaleLowerCase("pl-PL");
}

const itemName = requiredName(ITEM_NAME_MAX_LENGTH);

/** Pusta notatka to brak notatki (`null`). */
const itemNote = z
  .string({ error: "invalid" })
  .trim()
  .max(ITEM_NOTE_MAX_LENGTH, { error: "too_long" })
  .refine(withoutNul, { error: "invalid" })
  .nullish()
  .transform((note) => note || null);

/** Treść `POST /api/v1/lists/:listId/items`; `id` klienta czyni ponowienie bezpiecznym (F-15). */
export const createItemRequestSchema = z.object({
  id: z.uuid({ error: "invalid" }).optional(),
  name: itemName,
  note: itemNote,
});

export type CreateItemRequest = z.input<typeof createItemRequestSchema>;

/**
 * Treść `PATCH /api/v1/lists/:listId/items/:itemId`: zmienia tylko podane pola; `checked`
 * odhacza lub odznacza pozycję (F-08).
 */
export const updateItemRequestSchema = z.object({
  name: itemName.optional(),
  note: itemNote.optional(),
  checked: z.boolean({ error: "invalid" }).optional(),
});

export type UpdateItemRequest = z.input<typeof updateItemRequestSchema>;

/** Pozycja w odpowiedziach API (api.md, „Pozycje”); autor `null` = „usunięty użytkownik” (F-10). */
export interface Item {
  id: string;
  name: string;
  note: string | null;
  addedBy: Person | null;
  checked: boolean;
  checkedBy: Person | null;
  checkedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Odpowiedź `POST /api/v1/lists/:listId/items/clear-checked` (F-08). */
export interface ClearCheckedResponse {
  deletedIds: string[];
}
