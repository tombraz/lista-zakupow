import { useRef } from "react";
import { deleteAccount } from "../../api/account";
import { ApiRequestError } from "../../api/client";
import { useGuardedMutation } from "../../api/useGuardedMutation";
import { useEndSession } from "../../session/useSession";

/**
 * F-04: trwałe usunięcie konta; po nim sesja klienta się kończy, a `RequireSession` prowadzi na
 * SC-01 (`replace`) z „Konto zostało usunięte.”. Ponowienie po utraconej odpowiedzi dostaje 401, bo konta i sesji
 * już nie ma — to też usunięcie, bez fałszywego „Nie udało się”. 401 przy pierwszej próbie to
 * zwykły koniec sesji (wygasła, wylogowanie w innej karcie): obsługuje go `RequireSession`.
 */
export function useDeleteAccount() {
  const endSession = useEndSession();
  const attempts = useRef(0);
  return useGuardedMutation({
    mutationFn: async () => {
      attempts.current += 1;
      try {
        await deleteAccount();
      } catch (error) {
        const retried = attempts.current > 1;
        if (!(retried && error instanceof ApiRequestError && error.status === 401)) throw error;
      }
    },
    onSuccess: () => {
      endSession("accountDeleted");
    },
  });
}
