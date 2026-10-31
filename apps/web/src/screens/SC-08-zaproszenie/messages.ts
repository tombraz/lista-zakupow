import type { RequestErrorCode } from "../../api/client";
import { errorText } from "../../errorText";

/** Teksty z tabeli „Copy” SC-08 (docs/design/screens/SC-08-zaproszenie.md). */
export const messages = {
  title: "Zaproszenie do listy",
  body: (owner: string, list: string) => `${owner} zaprasza Cię do listy „${list}”.`,
  join: "Dołącz do listy",
  later: "Nie teraz",
  registerJoin: "Załóż konto i dołącz",
  loginJoin: "Mam konto — zaloguj się",
  checking: "Sprawdzamy zaproszenie…",
  invalid: {
    title: "Ten link nie działa",
    body: "Zaproszenie wygasło, zostało już użyte albo unieważnione. Poproś właściciela listy o nowy link.",
    cta: "Przejdź do aplikacji",
  },
  limit: "Lista ma już 20 uczestników, więc nie możesz dołączyć. Daj znać właścicielowi listy.",
  already: "Już jesteś na tej liście.",
  own: "To Twoja lista — nie musisz dołączać.",
  open: "Otwórz listę",
};

/** Błąd sprawdzenia lub dołączenia, który nie ma własnego stanu ekranu. */
export function failureText(code: RequestErrorCode): string {
  return errorText(code, {
    rate_limited: "Zbyt wiele prób. Spróbuj ponownie za minutę.",
    otherwise: "Coś poszło nie tak. Spróbuj ponownie.",
  });
}
