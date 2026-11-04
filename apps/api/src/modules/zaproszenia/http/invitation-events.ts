import type { FastifyBaseLogger } from "fastify";
import { afterCommit } from "../../../http/after-commit";
import { announceAccessChanges, type Lists } from "../../listy";
import type { Live } from "../../na-zywo";
import { acceptInvitation, type InvitationsContext } from "../domain/invitations";

export interface InvitationEvents {
  live: Live;
  lists: Pick<Lists, "peopleWithAccess">;
  /** Log żądania: błąd rozesłania po zatwierdzeniu trafia tylko tam (`afterCommit`, T-089). */
  log: FastifyBaseLogger;
}

/**
 * F-12, F-14: przyjęcie linku (z SC-08 albo przy rejestracji), a po zatwierdzeniu: nowy uczestnik
 * u subskrybentów listy, wykorzystany link znika z SC-07 właściciela, lista na SC-05 wszystkich
 * (także nowego uczestnika).
 */
export async function acceptAndAnnounce(
  invitations: InvitationsContext,
  { live, lists, log }: InvitationEvents,
  token: string,
  userId: string,
): Promise<string> {
  const listId = await acceptInvitation(invitations, token, userId);
  await afterCommit(log, async () => {
    const people = await lists.peopleWithAccess(listId);
    if (people) live.notify([people.ownerId], { type: "invitations.changed", listId });
    await announceAccessChanges(live, [{ kind: "members-changed", listId, people }]);
  });
  return listId;
}
