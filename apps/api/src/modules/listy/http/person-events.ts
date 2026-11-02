import type { Live } from "../../na-zywo";
import { everyone, type ListPeople, type ListsRepository } from "../domain/lists";

/**
 * F-16, F-14: po zmianie imienia osoby jej listy pobierają uczestników i pozycje od nowa
 * (`members.changed`; `updatedAt` pozycji się nie zmienia, więc zdarzenie pozycji klient by
 * zignorował), a SC-05 wszystkich z dostępem do tych list — także jej samej — się odświeża.
 */
export async function announceRenamedPerson(
  live: Pick<Live, "publish" | "notify">,
  repository: Pick<ListsRepository, "listsOf">,
  userId: string,
): Promise<void> {
  const lists = await repository.listsOf(userId);
  const people = new Set<string>();
  for (const list of lists) {
    live.publish({ type: "members.changed", listId: list.id });
    const access = { ownerId: list.owner.id, participantIds: list.members.map(({ id }) => id) };
    for (const id of everyone(access)) people.add(id);
  }
  if (people.size > 0) live.notify([...people], { type: "lists.changed" });
}

/**
 * F-04, F-14 po zatwierdzonym usunięciu konta (`lists` zebrane przed usunięciem): jego listy
 * znikają u uczestników (`list.deleted`, MC-03 `revoke`), na cudzych listach uczestnicy i pozycje
 * („usunięty użytkownik”) odświeżają się (`members.changed`), a SC-05 wszystkich dotkniętych
 * osób też. Połączenia samego konta zamyka moduł `konta`.
 */
export function announceDeletedPerson(
  live: Pick<Live, "publish" | "notify" | "revoke">,
  lists: (ListPeople & { listId: string })[],
  userId: string,
): void {
  const people = new Set<string>();
  for (const list of lists) {
    const others = everyone(list).filter((id) => id !== userId);
    if (list.ownerId === userId) {
      live.publish({ type: "list.deleted", listId: list.listId });
      for (const id of everyone(list)) live.revoke(id, list.listId);
    } else {
      live.revoke(userId, list.listId);
      live.publish({ type: "members.changed", listId: list.listId });
    }
    for (const id of others) people.add(id);
  }
  if (people.size > 0) live.notify([...people], { type: "lists.changed" });
}
