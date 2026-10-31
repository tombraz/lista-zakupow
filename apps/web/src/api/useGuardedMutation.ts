import {
  useMutation,
  type DefaultError,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useRef, useState } from "react";

/**
 * `useMutation` z synchroniczną blokadą podwójnego wysłania (T-020): `mutate` w czasie zapisu
 * nic nie wysyła. Przycisk w stanie zapisu (`isPending` → `loading`) blokuje dopiero po
 * przerysowaniu, więc drugie kliknięcie albo Enter przed nim wysłałby drugie żądanie.
 * `lockOf`: osobna blokada dla każdego klucza (np. unieważnianie różnych linków naraz).
 * `isLocked(key)`: stan zapisu elementu do renderu, dopóki trwa jego blokada — `isPending` i
 * `variables` opisują tylko ostatnie z równoległych wywołań (T-043).
 */
export function useGuardedMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
  lockOf: (variables: TVariables) => unknown = () => undefined,
): UseMutationResult<TData, TError, TVariables, TContext> & {
  isLocked: (key: unknown) => boolean;
} {
  // Ref do synchronicznej blokady, stan do renderu.
  const locked = useRef(new Set<unknown>());
  const [lockedKeys, setLockedKeys] = useState<ReadonlySet<unknown>>(new Set());
  const sync = () => {
    setLockedKeys(new Set(locked.current));
  };
  const mutation = useMutation({
    ...options,
    // Wywołanie zwrotne hooka, nie `mutate`: to drugie nie przychodzi po odmontowaniu.
    onSettled: (...settled) => {
      locked.current.delete(lockOf(settled[2]));
      sync();
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
      sync();
      mutation.mutate(...call);
    },
    isLocked: (key) => lockedKeys.has(key),
  };
}
