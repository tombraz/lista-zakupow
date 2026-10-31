import type { ListSummary } from "@lista/shared";
import { useEffect, useRef, useState } from "react";
import { messages } from "./messages";

/**
 * SC-05 „Accessibility”: lista udostępniona przez inną osobę w czasie, gdy ekran jest otwarty,
 * jest ogłaszana `polite` („Nowa lista: <nazwa>”) bez przenoszenia fokusu. Listy z pierwszego
 * wczytania i własne nowe listy (po nich SC-06) nie są ogłaszane.
 */
export function useNewListAnnouncement(lists: ListSummary[] | undefined): string {
  const known = useRef<Set<string> | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!lists) return;
    const seen = known.current;
    known.current = new Set(lists.map(({ id }) => id));
    if (!seen) return;
    const shared = lists.filter(({ id, role }) => role === "participant" && !seen.has(id));
    if (shared.length > 0)
      setAnnouncement(shared.map(({ name }) => messages.newList(name)).join(". "));
  }, [lists]);

  return announcement;
}
