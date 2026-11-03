import { z } from "zod";
import type { Person } from "./person";
import { optionalNote, requiredName } from "./text";

/** Nazwa pozycji 1–100 znaków, ilość / notatka do 200 (F-07). */
export const ITEM_NAME_MAX_LENGTH = 100;
export const ITEM_NOTE_MAX_LENGTH = 200;

const IGNORABLE = /\p{Default_Ignorable_Code_Point}/gu;

/**
 * Klucz porównania nazw pozycji (F-09, ADR 0004): `item.name_key` w bazie i lokalne sprawdzenie
 * w klientach. Jedyne miejsce tej reguły; jej zmiana wymaga migracji przeliczającej klucze.
 * NFKC i usunięcie znaków ignorowalnych: „ﬁlet”, „ｍｌｅｋｏ” i „Mleko” z niewidocznym znakiem to
 * duplikaty (TH-29); końcowy `trim`, bo usunięty znak mógł stać za spacją.
 */
export function normalizeItemName(name: string): string {
  return name.trim().normalize("NFKC").replace(IGNORABLE, "").trim().toLocaleLowerCase("pl-PL");
}

/**
 * T-060 (decyzja właściciela 2026-11-01): nazwa pozycji odrzucona jako `invalid` (ukryte znaki)
 * i nic poza nią. Klient i API sprawdzają wtedy najpierw, czy jej klucz ma inna pozycja listy:
 * „Mleko” z niewidocznym znakiem przy „Mleko” to duplikat (F-09), nie błąd pola.
 */
export function onlyItemNameInvalid(fields: Partial<Record<string, string>>): boolean {
  const names = Object.keys(fields);
  return names.length === 1 && fields.name === "invalid";
}

const itemName = requiredName(ITEM_NAME_MAX_LENGTH);

/** Pusta notatka to brak notatki (`null`). */
const itemNote = optionalNote(ITEM_NOTE_MAX_LENGTH)
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
