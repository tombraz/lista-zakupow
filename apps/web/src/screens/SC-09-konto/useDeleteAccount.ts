import { useRef } from "react";
import { deleteAccount } from "../../api/account";
import { ApiRequestError } from "../../api/client";
import { useGuardedMutation } from "../../api/useGuardedMutation";
import { useEndSession } from "../../session/useSession";

/**
 * F-04: trwałe usunięcie konta; po nim sesja klienta się kończy, a `RequireSession` prowadzi na
 * SC-01 (`replace`) z „Konto zostało usunięte.”. Ponowienie po utraconej odpowiedzi (błąd sieci)
 * dostaje 401, bo konta i sesji już nie ma — to też usunięcie, bez fałszywego „Nie udało się”.
 * Każde inne 401 (pierwsza próba, ponowienie po 500 czy 429) to zwykły koniec sesji (wygasła,
 * wylogowanie w innej karcie): obsługuje go `RequireSession` (T-072). `reset` (otwarcie okna
 * potwierdzenia) zapomina utraconą odpowiedź.
 */
export function useDeleteAccount() {
  const endSession = useEndSession();
  // Któraś próba w tym oknie mogła usunąć konto, choć jej odpowiedź nie dotarła.
  const lostResponse = useRef(false);
  const mutation = useGuardedMutation({
    mutationFn: async () => {
      try {
        await deleteAccount();
      } catch (error) {
        if (!(error instanceof ApiRequestError)) throw error;
        if (error.status === 401 && lostResponse.current) return;
        if (error.code === "network") lostResponse.current = true;
        throw error;
      }
    },
    onSuccess: () => {
      endSession("accountDeleted");
    },
  });
  return {
    ...mutation,
    reset: () => {
      lostResponse.current = false;
      mutation.reset();
    },
  };
}
