import type { Live } from "../../na-zywo";
import { everyone, type ListPeople } from "./lists";

/** Lista z osobami, które mają do niej dostęp. */
export interface ListWithPeople extends ListPeople {
  listId: string;
}

export type ListEvents = Pick<Live, "publish" | "notify" | "revoke">;

/** Zatwierdzona zmiana dostępu do jednej listy. */
export type AccessChange =
  /** Lista usunięta; `people` — kto miał do niej dostęp. */
  | { kind: "list-deleted"; listId: string; people: ListPeople | null }
  /**
   * Zmienił się skład osób listy; `people` — kto ma dostęp po zmianie (może jeszcze być w drodze
   * z bazy: subskrypcja `lostAccess` znika bez czekania), `lostAccess` — kto go właśnie stracił.
   */
  | {
      kind: "members-changed";
      listId: string;
      people: ListPeople | null | Promise<ListPeople | null>;
      lostAccess?: string;
    };

/**
 * Jedyne miejsce zdarzeń na żywo po zmianie dostępu do list (usunięcie listy, usunięcie lub
 * opuszczenie listy przez uczestnika, przyjęcie zaproszenia, zmiana imienia, usunięcie konta).
 * MC-03 (TH-04): `revoke` od razu po zmianie, zanim pójdzie dalsze zdarzenie listy; F-14 (T-032):
 * SC-05 wszystkich dotkniętych — także autora zmiany — odświeża się jednym `lists.changed`.
 * `skip`: osoba bez `lists.changed` (usunięte konto; jego połączenia zamyka moduł `konta`).
 */
export async function announceAccessChanges(
  live: ListEvents,
  changes: readonly AccessChange[],
  skip?: string,
): Promise<void> {
  for (const change of changes) announceOnList(live, change);
  const recipients = new Set<string>();
  for (const change of changes) {
    if (change.kind === "members-changed" && change.lostAccess) recipients.add(change.lostAccess);
    for (const id of everyone(await change.people)) recipients.add(id);
  }
  if (skip) recipients.delete(skip);
  if (recipients.size > 0) live.notify([...recipients], { type: "lists.changed" });
}

/** Zdarzenia kanału listy; `revoke` przed każdym dalszym zdarzeniem tej listy (MC-03). */
function announceOnList(live: ListEvents, change: AccessChange): void {
  if (change.kind === "list-deleted") {
    live.publish({ type: "list.deleted", listId: change.listId });
    for (const id of everyone(change.people)) live.revoke(id, change.listId);
    return;
  }
  if (change.lostAccess) live.revoke(change.lostAccess, change.listId);
  live.publish({ type: "members.changed", listId: change.listId });
}

/**
 * F-04: zmiany po usunięciu konta (`lists` zebrane przed usunięciem). Jego listy znikają; na
 * cudzych listach stracił dostęp, a uczestnicy i pozycje („usunięty użytkownik”) odświeżają się.
 */
export function accountDeletionChanges(
  lists: readonly ListWithPeople[],
  userId: string,
): AccessChange[] {
  return lists.map(({ listId, ...people }) =>
    people.ownerId === userId
      ? { kind: "list-deleted", listId, people }
      : { kind: "members-changed", listId, people, lostAccess: userId },
  );
}

/** F-16, F-14: po zmianie imienia osoby jej listy pobierają uczestników i pozycje od nowa. */
export function renameChanges(lists: readonly ListWithPeople[]): AccessChange[] {
  return lists.map(({ listId, ...people }) => ({ kind: "members-changed", listId, people }));
}
