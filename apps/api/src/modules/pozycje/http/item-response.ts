import type { Item } from "@lista/shared";
import type { ListItem } from "../domain/items";

/** Pozycja w kształcie odpowiedzi API (api.md, „Pozycje”): osoby tylko z imieniem (TH-19). */
export function itemResponse(listItem: ListItem): Item {
  return {
    id: listItem.id,
    name: listItem.name,
    note: listItem.note,
    addedBy: listItem.addedBy,
    checked: listItem.checkedAt !== null,
    checkedBy: listItem.checkedBy,
    checkedAt: listItem.checkedAt?.toISOString() ?? null,
    createdAt: listItem.createdAt.toISOString(),
    updatedAt: listItem.updatedAt.toISOString(),
  };
}
