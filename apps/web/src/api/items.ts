import type {
  ClearCheckedResponse,
  CreateItemRequest,
  Item,
  UpdateItemRequest,
} from "@lista/shared";
import { apiRequest } from "./client";

const itemsPath = (listId: string) => `/api/v1/lists/${encodeURIComponent(listId)}/items`;
const itemPath = (listId: string, itemId: string) =>
  `${itemsPath(listId)}/${encodeURIComponent(itemId)}`;

export function addItem(listId: string, item: CreateItemRequest): Promise<Item> {
  return apiRequest<Item>(itemsPath(listId), { body: item });
}

export function updateItem(listId: string, itemId: string, changes: UpdateItemRequest) {
  return apiRequest<Item>(itemPath(listId, itemId), { method: "PATCH", body: changes });
}

export async function deleteItem(listId: string, itemId: string): Promise<void> {
  await apiRequest(itemPath(listId, itemId), { method: "DELETE" });
}

/** F-08: odhacza (`true`) albo odznacza pozycję. */
export function checkItem(listId: string, itemId: string, checked: boolean): Promise<Item> {
  return updateItem(listId, itemId, { checked });
}

/** F-08: „Usuń wszystkie kupione”. */
export function clearChecked(listId: string): Promise<ClearCheckedResponse> {
  return apiRequest<ClearCheckedResponse>(`${itemsPath(listId)}/clear-checked`, {
    method: "POST",
  });
}
