import type { Item } from "@lista/shared";
import { useEffect, useRef, useState } from "react";
import type { CheckFocus } from "./useCheckItem";

interface FocusRequest {
  target: CheckFocus;
  /** Pozycja po zapisie: fokus dopiero, gdy lista na ekranie ją pokazuje (cache odświeża się później). */
  settled: Item | null;
  seq: number;
}

/**
 * Fokus na checkboxie pozycji albo przycisku „Kupione (N)” po renderze, w którym pozycja już
 * zmieniła sekcję (SC-06, „Accessibility”). `seq` ponawia fokus na tym samym celu.
 */
export function useCheckboxFocus(items: Item[]) {
  const checkboxes = useRef(new Map<string, HTMLButtonElement>());
  const boughtToggle = useRef<HTMLButtonElement>(null);
  const [request, setRequest] = useState<FocusRequest | null>(null);
  const done = useRef(0);

  useEffect(() => {
    if (!request || done.current === request.seq) return;
    const { target, settled } = request;
    const shown = settled === null || items.some((item) => sameState(item, settled));
    if (!shown) return;
    done.current = request.seq;
    const itemId = "itemId" in target ? target.itemId : firstUnchecked(items, target.unchecked);
    const element = itemId ? checkboxes.current.get(itemId) : boughtToggle.current;
    element?.focus();
  }, [request, items]);

  return {
    boughtToggle,
    register: (itemId: string) => (checkbox: HTMLButtonElement | null) => {
      if (checkbox) checkboxes.current.set(itemId, checkbox);
      else checkboxes.current.delete(itemId);
    },
    focus: (target: CheckFocus, settled: Item | null = null) => {
      setRequest((current) => ({ target, settled, seq: (current?.seq ?? 0) + 1 }));
    },
  };
}

export type CheckboxFocus = ReturnType<typeof useCheckboxFocus>;

const sameState = (a: Item, b: Item) => a.id === b.id && a.checked === b.checked;

const firstUnchecked = (items: Item[], ids: string[]) =>
  ids.find((id) => items.some((item) => item.id === id && !item.checked));
