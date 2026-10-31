import type { Invitation } from "@lista/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { asRequestError, type RequestErrorCode } from "../../api/client";
import { createInvitation, fetchInvitations, revokeInvitation } from "../../api/invitations";
import { listKey } from "../../lists/useList";
import { useLive } from "../../live/LiveProvider";
import { useGuardedMutation } from "../../api/useGuardedMutation";

export const invitationsKey = (listId: string) => [...listKey(listId), "invitations"] as const;

/**
 * Aktywne linki listy (tylko właściciel: `enabled`); link użyty lub unieważniony gdzie indziej
 * znika na żywo (`invitations.changed`, F-11, F-14).
 */
export function useInvitations(listId: string, enabled: boolean) {
  const live = useLive();
  const client = useQueryClient();
  useEffect(
    () =>
      live?.onMessage((message) => {
        if (message.type === "invitations.changed" && message.listId === listId) {
          void client.invalidateQueries({ queryKey: invitationsKey(listId) });
        }
      }),
    [live, client, listId],
  );
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

  const create = useGuardedMutation({
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
  const revoke = useGuardedMutation(
    {
      mutationFn: (invitationId: string) => revokeInvitation(listId, invitationId),
      onMutate: () => {
        setFailure(undefined);
      },
      onSuccess: (_, invitationId) => {
        setLinks((links) => links.filter(({ id }) => id !== invitationId));
        onRevoked();
      },
      onError: fail("revoke"),
    },
    // Różne linki można unieważniać naraz; ten sam tylko raz.
    (invitationId) => invitationId,
  );
  return { create, revoke, failure };
}
