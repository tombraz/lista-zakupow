import type { ListDetails, ListSummary } from "@lista/shared";
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

export function renameList(listId: string, name: string): Promise<ListSummary> {
  return apiRequest<ListSummary>(`/api/v1/lists/${encodeURIComponent(listId)}`, {
    method: "PATCH",
    body: { name },
  });
}

export async function deleteList(listId: string): Promise<void> {
  await apiRequest(`/api/v1/lists/${encodeURIComponent(listId)}`, { method: "DELETE" });
}
