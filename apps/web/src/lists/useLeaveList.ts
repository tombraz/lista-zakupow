import type { ListSummary } from "@lista/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { asRequestError } from "../api/client";
import { leaveList } from "../api/lists";
import { useGuardedMutation } from "../api/useGuardedMutation";
import { leaveListKey } from "./ownExit";
import { listKey } from "./useList";
import { LISTS_KEY } from "./useLists";
import { membersKey } from "./useMembers";

/**
 * F-13: uczestnik opuszcza listę i wraca na SC-05 bez niej (`replace`: SC-07 znika z historii).
 * 404 znaczy, że już go na liście nie ma (ponowienie po utraconej odpowiedzi, właściciel usunął
 * go w tym samym czasie) — to też wyjście, bez błędu. `access.revoked` w trakcie zapisu pomija
 * `useLiveList` (`leaveListKey`), więc przejście na SC-05 jest jedno.
 */
export function useLeaveList(listId: string) {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useGuardedMutation({
    mutationKey: leaveListKey(listId),
    mutationFn: async () => {
      try {
        await leaveList(listId);
      } catch (error) {
        if (asRequestError(error).code !== "not_found") throw error;
      }
    },
    onSuccess: () => {
      // Bez optymistycznych zmian (F-15): lista znika z SC-05 po odpowiedzi API.
      client.setQueryData<ListSummary[]>(LISTS_KEY, (lists) =>
        lists?.filter(({ id }) => id !== listId),
      );
      client.removeQueries({ queryKey: listKey(listId) });
      client.removeQueries({ queryKey: membersKey(listId) });
      void client.invalidateQueries({ queryKey: LISTS_KEY, exact: true });
      void navigate("/listy", { replace: true });
    },
  });
}
