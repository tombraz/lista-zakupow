import type { SignUpInvitation } from "@lista/shared";
import { DomainError } from "../../../domain-error";
import { domainErrorBody } from "../../../http/api-error";
import type { InvitationOnSignUp } from "../../konta";
import type { InvitationsContext } from "../domain/invitations";
import { acceptAndAnnounce, type InvitationEvents } from "./invitation-events";

/**
 * F-01, F-12: rejestracja z linku od razu dołącza do listy. Błąd zaproszenia (np. link
 * w międzyczasie wygasł) nie cofa założonego konta — wraca w treści odpowiedzi (api.md).
 */
export function acceptOnSignUp(
  invitations: InvitationsContext,
  events: Omit<InvitationEvents, "log">,
): InvitationOnSignUp {
  return async (userId, token, log): Promise<SignUpInvitation> => {
    try {
      return { listId: await acceptAndAnnounce(invitations, { ...events, log }, token, userId) };
    } catch (error) {
      if (error instanceof DomainError) return domainErrorBody(error);
      throw error;
    }
  };
}
