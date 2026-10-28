import type { AcceptInvitationResponse, Invitation, InvitationPreview } from "@lista/shared";
import { apiRequest } from "./client";

const invitationsOf = (listId: string) => `/api/v1/lists/${encodeURIComponent(listId)}/invitations`;
const byToken = (token: string) => `/api/v1/invitations/${encodeURIComponent(token)}`;

export function fetchInvitations(listId: string): Promise<Invitation[]> {
  return apiRequest<Invitation[]>(invitationsOf(listId));
}

export function createInvitation(listId: string): Promise<Invitation> {
  return apiRequest<Invitation>(invitationsOf(listId), { method: "POST" });
}

export async function revokeInvitation(listId: string, invitationId: string): Promise<void> {
  await apiRequest(`${invitationsOf(listId)}/${encodeURIComponent(invitationId)}`, {
    method: "DELETE",
  });
}

export function previewInvitation(token: string): Promise<InvitationPreview> {
  return apiRequest<InvitationPreview>(byToken(token));
}

export function acceptInvitation(token: string): Promise<AcceptInvitationResponse> {
  return apiRequest<AcceptInvitationResponse>(`${byToken(token)}/accept`, { method: "POST" });
}
