import type { Invitation } from "@lista/shared";

/** Token z adresu linku (`<web>/zaproszenie/<token>`). */
export function tokenOf(invitation: Pick<Invitation, "url">): string {
  return invitation.url.split("/").pop() ?? "";
}
