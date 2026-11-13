import type { Participant } from "@lista/shared";
import { useEffect, useRef, useState } from "react";

interface FocusRequest {
  /** Uczestnicy za usuniętym, w kolejności z chwili potwierdzenia. */
  after: string[];
  seq: number;
}

/**
 * SC-07 „Accessibility”: po usunięciu fokus na następnym wierszu („Usuń” kolejnej osoby), a gdy
 * dalej nikogo nie ma — na nagłówku „Na liście”. Cel wybierany po renderze wobec aktualnych
 * uczestników, nie w chwili kliknięcia: kolejna osoba mogła w międzyczasie zniknąć (inne usunięcie,
 * odejście na żywo) i fokus spadłby na `body` (T-039, WCAG 2.4.3).
 */
export function useRemovalFocus(participants: Participant[]) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [request, setRequest] = useState<FocusRequest | null>(null);
  const done = useRef(0);
  const orders = useRef(new Map<string, string[]>());

  useEffect(() => {
    if (!request || done.current === request.seq) return;
    done.current = request.seq;
    const next = request.after.find((id) => participants.some((person) => person.id === id));
    (next ? buttons.current.get(next) : headingRef.current)?.focus();
  }, [request, participants]);

  return {
    headingRef,
    register: (userId: string) => (button: HTMLButtonElement | null) => {
      if (button) buttons.current.set(userId, button);
      else buttons.current.delete(userId);
    },
    /** Przy potwierdzeniu: kto jest za `person` w tej chwili. */
    remember: (person: Participant) => {
      const index = participants.findIndex(({ id }) => id === person.id);
      orders.current.set(
        person.id,
        participants.slice(index + 1).map(({ id }) => id),
      );
    },
    /**
     * Po usunięciu `person`: fokus na pierwszej z zapamiętanych osób, która jeszcze jest.
     * Idempotentne: powtórne wywołanie (kolejny render, StrictMode) celuje w ten sam wiersz,
     * więc kolejności nie zużywa; nadpisuje ją następne `remember` (T-097).
     */
    focusAfter: (person: Participant) => {
      const after = orders.current.get(person.id) ?? [];
      setRequest((current) => ({ after, seq: (current?.seq ?? 0) + 1 }));
    },
  };
}
