import {
  useMutation,
  type DefaultError,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useRef } from "react";

/**
 * `useMutation` z synchroniczną blokadą podwójnego wysłania (T-020): `mutate` w czasie zapisu
 * nic nie wysyła. Przycisk w stanie zapisu (`isPending` → `loading`) blokuje dopiero po
 * przerysowaniu, więc drugie kliknięcie albo Enter przed nim wysłałby drugie żądanie.
 * `lockOf`: osobna blokada dla każdego klucza (np. unieważnianie różnych linków naraz).
 */
export function useGuardedMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
  lockOf: (variables: TVariables) => unknown = () => undefined,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const locked = useRef(new Set<unknown>());
  const mutation = useMutation({
    ...options,
    // Wywołanie zwrotne hooka, nie `mutate`: to drugie nie przychodzi po odmontowaniu.
    onSettled: (...settled) => {
      locked.current.delete(lockOf(settled[2]));
      return options.onSettled?.(...settled);
    },
  });
  return {
    ...mutation,
    mutate: (...call) => {
      // Bez zmiennych (`void`) `call[0]` to `undefined`.
      const lock = lockOf(call[0] as TVariables);
      if (locked.current.has(lock)) return;
      locked.current.add(lock);
      mutation.mutate(...call);
    },
  };
}
