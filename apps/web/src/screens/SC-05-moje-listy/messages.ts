import type { RequestErrorCode } from "../../api/client";
import { errorText } from "../../errorText";

/** Teksty z tabeli „Copy” SC-05 (docs/design/screens/SC-05-moje-listy.md). */
export const messages = {
  title: "Moje listy",
  account: "Konto",
  card: {
    toBuy: (count: number) => `${String(count)} do kupienia`,
    sharedBy: (name: string) => `od ${name}`,
    sharedByLabel: (name: string) => `udostępniona przez ${name}`,
  },
  new: {
    open: "+ Nowa lista",
    label: "Nazwa listy",
    placeholder: "np. Zakupy na tydzień",
    submit: "Utwórz",
  },
  cancel: "Anuluj",
  limit: "Masz już 50 list — to limit. Usuń listę, której nie używasz, żeby utworzyć nową.",
  loadError: "Nie udało się wczytać list.",
  empty: { text: "Nie masz jeszcze żadnej listy.", cta: "Utwórz pierwszą listę" },
};

/** Nieudane utworzenie listy (tekst agenta; tabela „Copy” go nie ma). */
export function createErrorText(code: RequestErrorCode): string {
  return errorText(code, { otherwise: "Nie udało się utworzyć listy. Spróbuj ponownie." });
}
