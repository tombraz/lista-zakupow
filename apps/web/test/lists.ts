import type { ListDetails, ListSummary, Me } from "@lista/shared";
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
export function detailsOf(list: ListSummary): ListDetails {
  const { id, name, role, owner, members } = list;
  return { id, name, role, owner, members, items: [] };
}

/** `GET /api/v1/lists` odpowiada podanymi listami. */
export function listsAre(lists: ListSummary[]) {
  server.use(http.get("*/api/v1/lists", () => HttpResponse.json(lists)));
}

export function apiError(status: number, error: object) {
  return HttpResponse.json({ error }, { status });
}
