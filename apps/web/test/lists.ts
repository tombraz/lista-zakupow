import type { Item, ListDetails, ListMembers, ListSummary, Me } from "@lista/shared";
import { http, HttpResponse } from "msw";
import { server } from "./msw-server";

export const ANIA: Me = { id: "u-ania", name: "Ania", email: "ania@example.com" };
export const TOMEK = { id: "u-tomek", name: "Tomek" };

let sequence = 0;

/** Lista w kształcie `GET /api/v1/lists` (domyślnie własna lista Ani). */
export function aList(overrides: Partial<ListSummary> = {}): ListSummary {
  sequence += 1;
  return {
    id: `00000000-0000-7000-8000-${String(sequence).padStart(12, "0")}`,
    name: `Lista ${String(sequence)}`,
    role: "owner",
    owner: { id: ANIA.id, name: ANIA.name },
    toBuyCount: 0,
    members: [],
    updatedAt: "2026-10-28T10:00:00.000Z",
    ...overrides,
  };
}

/** Szczegóły listy w kształcie `GET /api/v1/lists/:listId`. */
export function detailsOf(list: ListSummary, items: Item[] = []): ListDetails {
  const { id, name, role, owner, members } = list;
  return { id, name, role, owner, members, items };
}

/** Adres osoby w odpowiedzi `GET …/members` dla właściciela (`<imię>@example.com`). */
export const emailOf = (person: { name: string }) =>
  `${person.name.toLocaleLowerCase("pl-PL")}@example.com`;

/**
 * Uczestnicy listy w kształcie `GET /api/v1/lists/:listId/members`, jak odpowiada serwer:
 * e-maile tylko w odpowiedzi dla właściciela (F-13, TH-19).
 */
export function membersOf(list: ListSummary): ListMembers {
  const withEmail = list.role === "owner";
  return {
    owner: list.owner,
    participants: list.members.map((person) =>
      withEmail ? { ...person, email: emailOf(person) } : person,
    ),
  };
}

/**
 * `GET /api/v1/lists/:listId` i `GET …/members` odpowiadają tą samą listą (SC-07); funkcja
 * podaje stan z chwili żądania (zmiana „na serwerze” w trakcie testu).
 */
export function listHandlers(list: ListSummary | (() => ListSummary)) {
  const current = typeof list === "function" ? list : () => list;
  return [
    http.get(`*/api/v1/lists/${current().id}`, () => HttpResponse.json(detailsOf(current()))),
    http.get(`*/api/v1/lists/${current().id}/members`, () =>
      HttpResponse.json(membersOf(current())),
    ),
  ];
}

/** Nieodhaczona pozycja dodana przez Anię, w kształcie `Item` z API. */
export function anItem(overrides: Partial<Item> = {}): Item {
  sequence += 1;
  return {
    id: `00000000-0000-7000-9000-${String(sequence).padStart(12, "0")}`,
    name: `Pozycja ${String(sequence)}`,
    note: null,
    addedBy: { id: ANIA.id, name: ANIA.name },
    checked: false,
    checkedBy: null,
    checkedAt: null,
    createdAt: "2026-10-28T10:00:00.000Z",
    updatedAt: "2026-10-28T10:00:00.000Z",
    ...overrides,
  };
}

/**
 * Odpowiedź API na zapis pozycji: zmienione pola i nowsze `updatedAt`, jak z serwera — cache
 * przyjmuje tylko nowszą wersję (api.md, T-017).
 */
export function savedItem(item: Item, changes: Partial<Item> = {}): Item {
  return { ...item, ...changes, updatedAt: "2026-10-28T12:00:00.000Z" };
}

/** `GET /api/v1/lists` odpowiada podanymi listami. */
export function listsAre(lists: ListSummary[]) {
  server.use(http.get("*/api/v1/lists", () => HttpResponse.json(lists)));
}

export function apiError(status: number, error: object) {
  return HttpResponse.json({ error }, { status });
}
