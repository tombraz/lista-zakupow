import { normalizeItemName, type Item } from "@lista/shared";

/**
 * Inna pozycja o tej samej nazwie (ta sama reguła co w bazie, ADR 0004) — szybka informacja;
 * rozstrzyga API. `exceptId`: pozycja nie jest duplikatem samej siebie (F-09).
 */
export function sameNameAs(items: Item[], name: string, exceptId?: string): Item | undefined {
  const key = normalizeItemName(name);
  return items.find((item) => item.id !== exceptId && normalizeItemName(item.name) === key);
}
