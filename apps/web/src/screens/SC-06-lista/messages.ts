import type { RequestErrorCode } from "../../api/client";
import { errorText } from "../../errorText";

/** Teksty z tabeli „Copy” SC-06 (docs/design/screens/SC-06-lista.md). */
export const messages = {
  back: "Wstecz",
  loadError: "Nie udało się wczytać listy.",
  noAccess: "Nie masz dostępu do tej listy.",
  backToLists: "Wróć do moich list",
  more: "Więcej opcji",
  menu: { rename: "Zmień nazwę listy", delete: "Usuń listę" },
  rename: { title: "Zmień nazwę listy", label: "Nazwa listy", save: "Zapisz" },
  delete: {
    question: (name: string) => `Usunąć listę „${name}”?`,
    confirm: "Usuń listę",
  },
  cancel: "Anuluj",
  empty: "Lista jest pusta. Dopisz pierwszą rzecz w polu na dole.",
};

/** Nieudany zapis zmiany (SC-06, „Error — zapis”). */
export function saveErrorText(code: RequestErrorCode): string {
  return errorText(code, { otherwise: "Nie udało się zapisać zmiany. Spróbuj ponownie." });
}

/** Skutek usunięcia listy (Copy `delete.confirm`); dla 0 uczestników tekst agenta. */
export function deleteConsequence(participants: number): string {
  if (participants === 0) return "Tego nie można cofnąć.";
  const noun = participants === 1 ? "uczestnika" : "uczestników";
  return `Zniknie też u ${String(participants)} ${noun}.`;
}
