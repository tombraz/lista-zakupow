import type { Live } from "../../na-zywo";
import { everyone, type ListsRepository } from "../domain/lists";

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
