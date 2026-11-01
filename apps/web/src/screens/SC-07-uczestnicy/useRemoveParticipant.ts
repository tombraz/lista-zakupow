import type { ListDetails, ListMembers, Participant } from "@lista/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { asRequestError } from "../../api/client";
import { removeParticipant } from "../../api/lists";
import { useGuardedMutation } from "../../api/useGuardedMutation";
import { listKey } from "../../lists/useList";
import { membersKey } from "../../lists/useMembers";

/**
 * F-13: właściciel usuwa uczestnika. Bez optymistycznych zmian (F-15): wiersz znika po odpowiedzi
 * API. 404 znaczy, że tej osoby już nie ma (odeszła sama, ponowienie po utraconej odpowiedzi) —
 * dla właściciela to też usunięcie, bez błędu. Różne osoby można usuwać naraz, tę samą raz.
 */
export function useRemoveParticipant(
  listId: string,
  /** `remaining` — liczba uczestników po usunięciu. */
  onRemoved: (person: Participant, remaining: number) => void,
) {
  const client = useQueryClient();
  const [failed, setFailed] = useState<string>();
  const removal = useGuardedMutation(
    {
      mutationFn: async (person: Participant) => {
        try {
          await removeParticipant(listId, person.id);
        } catch (error) {
          if (asRequestError(error).code !== "not_found") throw error;
        }
      },
      onMutate: (person) => {
        setFailed((current) => (current === person.id ? undefined : current));
      },
      onSuccess: (_, person) => {
        onRemoved(person, dropParticipant(client, listId, person.id));
      },
      onError: (_, person) => {
        setFailed(person.id);
      },
    },
    (person) => person.id,
  );
  return {
    remove: (person: Participant) => {
      removal.mutate(person);
    },
    isRemoving: (person: Participant) => removal.isLocked(person.id),
    failed: (person: Participant) => failed === person.id,
  };
}

export type ParticipantRemoval = ReturnType<typeof useRemoveParticipant>;

function dropParticipant(
  client: ReturnType<typeof useQueryClient>,
  listId: string,
  userId: string,
): number {
  const without = <T extends { id: string }>(people: T[]) =>
    people.filter(({ id }) => id !== userId);
  const members = client.setQueryData<ListMembers>(
    membersKey(listId),
    (current) => current && { ...current, participants: without(current.participants) },
  );
  client.setQueryData<ListDetails>(
    listKey(listId),
    (list) => list && { ...list, members: without(list.members) },
  );
  return members?.participants.length ?? 0;
}
