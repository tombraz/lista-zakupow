import { everyone, type Lists } from "../../listy";
import type { Live } from "../../na-zywo";
import { acceptInvitation, type InvitationsContext } from "../domain/invitations";

export interface InvitationEvents {
  live: Live;
  lists: Pick<Lists, "peopleWithAccess">;
}

/**
 * F-12, F-14: przyjęcie linku (z SC-08 albo przy rejestracji), a po zatwierdzeniu: nowy uczestnik
 * u subskrybentów listy, wykorzystany link znika z SC-07 właściciela, lista na SC-05 wszystkich
 * (także nowego uczestnika).
 */
export async function acceptAndAnnounce(
  invitations: InvitationsContext,
  { live, lists }: InvitationEvents,
  token: string,
  userId: string,
): Promise<string> {
  const listId = await acceptInvitation(invitations, token, userId);
  live.publish({ type: "members.changed", listId });
  const people = await lists.peopleWithAccess(listId);
  if (people) live.notify([people.ownerId], { type: "invitations.changed", listId });
  live.notify(everyone(people), { type: "lists.changed" });
  return listId;
}
