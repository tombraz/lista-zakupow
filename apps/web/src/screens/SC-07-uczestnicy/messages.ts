import { BUSINESS_LIMITS } from "@lista/shared";
import type { RequestErrorCode } from "../../api/client";
import { errorText } from "../../errorText";

const validUntil = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" });

/** Teksty z tabeli „Copy” SC-07 (docs/design/screens/SC-07-uczestnicy.md). */
export const messages = {
  title: "Uczestnicy",
  back: "Wstecz",
  members: (count: number) =>
    `Na liście (${String(count)} z ${String(BUSINESS_LIMITS.participantsPerList)})`,
  owner: "właściciel",
  you: "Ty",
  empty: "Nikt jeszcze nie dołączył. Utwórz link i wyślij go domownikowi.",
  loadError: "Nie udało się wczytać uczestników.",
  // SC-07, „No permission”: jak SC-06 (MC-01).
  noAccess: "Nie masz dostępu do tej listy.",
  backToLists: "Wróć do moich list",
  invites: "Zaproszenia",
  create: "Utwórz link zaproszenia",
  hint: "Link działa dla jednej osoby przez 7 dni. Wyślij go SMS-em lub komunikatorem.",
  validUntil: (expiresAt: string) =>
    `Link jednorazowy, ważny do ${validUntil.format(new Date(expiresAt))}`,
  copy: "Kopiuj",
  copied: "Link skopiowany",
  copyManually: "Skopiuj link ręcznie.",
  revoke: "Unieważnij",
  revoked: "Link unieważniony",
  limit: "Lista ma 20 uczestników — to limit. Usuń kogoś, żeby zaprosić nową osobę.",
};

/** Błąd utworzenia linku (limit 20 pokazuje osobne ostrzeżenie). */
export function createErrorText(code: RequestErrorCode): string {
  return errorText(code, {
    rate_limited: "Utworzono zbyt wiele linków. Spróbuj ponownie za godzinę.",
    otherwise: "Nie udało się utworzyć linku. Spróbuj ponownie.",
  });
}

export function revokeErrorText(code: RequestErrorCode): string {
  return errorText(code, { otherwise: "Nie udało się unieważnić linku. Spróbuj ponownie." });
}
