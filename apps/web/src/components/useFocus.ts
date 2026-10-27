import { useEffect, useState, type RefObject } from "react";

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
