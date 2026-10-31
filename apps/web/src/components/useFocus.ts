import { useEffect, useRef, useState, type RefObject } from "react";

/** Gdzie przenieść fokus po akcji; `seq` wymusza ponowny fokus na tym samym celu. */
export interface FocusRequest<T extends string> {
  target: T;
  seq: number;
}

export function useFocusRequest<T extends string>() {
  const [focus, setFocus] = useState<FocusRequest<T> | null>(null);
  const requestFocus = (target: T) => {
    setFocus((current) => ({ target, seq: (current?.seq ?? 0) + 1 }));
  };
  return [focus, requestFocus] as const;
}

/** Fokus startowy na `initial`, potem na celu wskazanym przez `focus` (po renderze). */
export function useFocusTargets<T extends string>(
  focus: FocusRequest<T> | null,
  targets: Record<T, RefObject<HTMLElement | null>>,
  initial: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    initial.current?.focus();
  }, [initial]);

  useEffect(() => {
    if (focus) targets[focus.target].current?.focus();
    // Cele to stałe refy; reagujemy tylko na nowe żądanie fokusu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);
}

/**
 * Limit wyłącza element (`disabled`), więc fokus z niego spadłby na `body` (WCAG 2.4.3). Gdy
 * `reached` zmienia się na prawdę, a fokus jest w `from` (albo już spadł na `body`), przechodzi na
 * ostrzeżenie ze zwróconym refem; wejście na ekran już przy limicie i fokus w innym miejscu ekranu
 * zostają bez zmian (T-023, T-025).
 */
export function useLimitFocus(reached: boolean, from: RefObject<HTMLElement | null>) {
  const ref = useRef<HTMLDivElement>(null);
  const wasReached = useRef(reached);
  useEffect(() => {
    const became = reached && !wasReached.current;
    wasReached.current = reached;
    if (!became) return;
    const focused = document.activeElement;
    if (focused === document.body || from.current?.contains(focused)) ref.current?.focus();
  }, [reached, from]);
  return ref;
}
