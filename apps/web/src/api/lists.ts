import type { ListDetails, ListMembers, ListSummary } from "@lista/shared";
import { apiRequest } from "./client";

export function fetchLists(): Promise<ListSummary[]> {
  return apiRequest<ListSummary[]>("/api/v1/lists");
}

export function createList(name: string): Promise<ListSummary> {
  return apiRequest<ListSummary>("/api/v1/lists", { body: { name } });
}

export function fetchList(listId: string): Promise<ListDetails> {
  return apiRequest<ListDetails>(`/api/v1/lists/${encodeURIComponent(listId)}`);
}

/** F-13: uczestnicy listy (SC-07); e-maile tylko w odpowiedzi dla właściciela. */
export function fetchMembers(listId: string): Promise<ListMembers> {
  return apiRequest<ListMembers>(`/api/v1/lists/${encodeURIComponent(listId)}/members`);
}

export function renameList(listId: string, name: string): Promise<ListSummary> {
  return apiRequest<ListSummary>(`/api/v1/lists/${encodeURIComponent(listId)}`, {
    method: "PATCH",
    body: { name },
  });
}

export async function deleteList(listId: string): Promise<void> {
  await apiRequest(`/api/v1/lists/${encodeURIComponent(listId)}`, { method: "DELETE" });
}

/** F-13: właściciel usuwa uczestnika; 404 — osoby już nie ma na liście (lub listy). */
export async function removeParticipant(listId: string, userId: string): Promise<void> {
  await apiRequest(
    `/api/v1/lists/${encodeURIComponent(listId)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}
