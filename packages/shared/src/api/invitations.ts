import type { Me } from "./account";
import type { ApiErrorBody } from "./errors";

/** Aktywny link zaproszenia (api.md, „Zaproszenia”); widzi go tylko właściciel listy. */
export interface Invitation {
  id: string;
  /** `<web>/zaproszenie/<token>` */
  url: string;
  expiresAt: string;
}

/** Podgląd ważnego linku (SC-08): tylko nazwa listy i imię właściciela (MC-02). */
export interface InvitationPreview {
  listName: string;
  ownerName: string;
}

/** `POST /api/v1/invitations/:token/accept` */
export interface AcceptInvitationResponse {
  listId: string;
}

/** Wynik przyjęcia zaproszenia przy rejestracji: lista albo błąd jak z `…/accept`. */
export type SignUpInvitation = AcceptInvitationResponse | { error: ApiErrorBody["error"] };

/** `POST /api/auth/sign-up/email`; `invitation` tylko przy `invitationToken`. */
export interface SignUpResponse {
  user: Me;
  invitation?: SignUpInvitation;
}
