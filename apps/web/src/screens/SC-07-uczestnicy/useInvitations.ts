import type { Invitation } from "@lista/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { asRequestError, type RequestErrorCode } from "../../api/client";
import { createInvitation, fetchInvitations, revokeInvitation } from "../../api/invitations";
import { listKey } from "../../lists/useList";

export const invitationsKey = (listId: string) => [...listKey(listId), "invitations"] as const;

/** Aktywne linki listy (tylko właściciel: `enabled`). */
export function useInvitations(listId: string, enabled: boolean) {
  return useQuery({
    queryKey: invitationsKey(listId),
    queryFn: () => fetchInvitations(listId),
    enabled,
  });
}

/**
 * Tworzenie i unieważnianie linków. Bez optymistycznych zmian (F-15): link pojawia się
 * lub znika po odpowiedzi API; po błędzie stan bierzemy z serwera (zapis mógł się udać).
 */
export function useInvitationChanges(
  listId: string,
  { onCreated, onRevoked }: { onCreated: (id: string) => void; onRevoked: () => void },
) {
  const client = useQueryClient();
  const [failure, setFailure] = useState<{ action: "create" | "revoke"; code: RequestErrorCode }>();
  const setLinks = (change: (links: Invitation[]) => Invitation[]) => {
    client.setQueryData<Invitation[]>(invitationsKey(listId), (links = []) => change(links));
  };
  const fail = (action: "create" | "revoke") => (error: unknown) => {
    const { code } = asRequestError(error);
    // `limit_reached`: lista ma już 20 uczestników — odśwież ją, ostrzeżenie pokaże się samo.
    setFailure(code === "limit_reached" ? undefined : { action, code });
    void client.invalidateQueries({ queryKey: listKey(listId) });
  };

  const create = useMutation({
    mutationFn: () => createInvitation(listId),
    onMutate: () => {
      setFailure(undefined);
    },
    onSuccess: (link) => {
      setLinks((links) => [link, ...links.filter(({ id }) => id !== link.id)]);
      onCreated(link.id);
    },
    onError: fail("create"),
  });
  const revoke = useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(listId, invitationId),
    onMutate: () => {
      setFailure(undefined);
    },
    onSuccess: (_, invitationId) => {
      setLinks((links) => links.filter(({ id }) => id !== invitationId));
      onRevoked();
    },
    onError: fail("revoke"),
  });
  return { create, revoke, failure };
}
