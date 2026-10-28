import {
  BUSINESS_LIMITS,
  ITEM_NAME_MAX_LENGTH,
  ITEM_NOTE_MAX_LENGTH,
  type FieldErrorCode,
  type Person,
} from "@lista/shared";
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
  toBuyHeading: "Do kupienia",
  add: {
    form: "Dodaj pozycję",
    label: "Co kupić?",
    noteLabel: "Ilość / notatka (opcjonalnie)",
    submit: "Dodaj",
    submitName: "Dodaj pozycję",
    added: (name: string) => `Dodano ${name}`,
  },
  edit: (name: string) => `Edytuj ${name}`,
  check: (name: string) => `Odhacz ${name}`,
  uncheck: (name: string) => `Odznacz ${name}`,
  checked: (name: string) => `Odhaczono ${name}`,
  toBuy: (count: number) => `${String(count)} do kupienia`,
  allBought: "Wszystko kupione.",
  bought: (count: number) => `Kupione (${String(count)})`,
  boughtHeading: "Kupione",
  clearBought: {
    open: "Usuń wszystkie kupione",
    question: (count: number) => `Usunąć ${String(count)} kupionych pozycji?`,
    consequence: "Tego nie można cofnąć.",
    confirm: "Usuń kupione",
  },
  dupBought: (name: string) =>
    `„${name}” jest już na liście jako kupione. Odznacz tę pozycję w sekcji „Kupione”, żeby kupić ponownie.`,
  dupShow: "Pokaż",
  editSheet: {
    title: "Edytuj pozycję",
    name: "Nazwa",
    save: "Zapisz",
    delete: "Usuń pozycję",
    deleted: "Ta pozycja została usunięta przez inną osobę.",
    close: "Zamknij",
  },
  dupRename: (name: string) => `Na liście jest już pozycja „${name}”. Wybierz inną nazwę.`,
  dupOpen: (name: string) => `„${name}” jest już na liście. Pozycja nie została dodana.`,
  limit: `Lista ma ${String(BUSINESS_LIMITS.itemsPerList)} pozycji — to limit. Usuń kupione albo niepotrzebne pozycje.`,
};

/** Podpis autora pozycji (Copy `addedBy`, `deletedUser`). */
export function addedByText(person: Person | null): string {
  return `dodał(a) ${person?.name ?? "usunięty użytkownik"}`;
}

/** Podpis odhaczającego (Copy `boughtBy`, `deletedUser`). */
export function boughtByText(person: Person | null): string {
  return `kupił(a) ${person?.name ?? "usunięty użytkownik"}`;
}

/** SC-06 „Error — długość”; pusta nazwa — tekst agenta jak „Wpisz nazwę listy” na SC-05. */
export function itemNameErrorText(code: FieldErrorCode): string {
  return code === "too_long"
    ? `Nazwa może mieć najwyżej ${String(ITEM_NAME_MAX_LENGTH)} znaków`
    : "Wpisz nazwę pozycji";
}

export function itemNoteErrorText(): string {
  return `Notatka może mieć najwyżej ${String(ITEM_NOTE_MAX_LENGTH)} znaków`;
}

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
