---
id: SC-08
title: Zaproszenie
requirements: [F-11, F-12]
journeys: [J-04]
platforms: [web]
design:
---

# SC-08 Zaproszenie

## Purpose

Osoba, która otworzyła link zaproszenia, dowiaduje się, do jakiej listy i od kogo jest zaproszona, i przyjmuje zaproszenie — po zalogowaniu albo założeniu konta. Jeśli link nie działa, dostaje jasny komunikat.

## Layout

Jasne tło, kolumna `content-max`, bez AppBar (ekran wejściowy).
1. `h1` „Zaproszenie do listy”.
2. Treść: „{imię właściciela} zaprasza Cię do listy „{nazwa listy}”.”
3. **Zalogowany:** przycisk główny „Dołącz do listy” + link „Nie teraz” → SC-05.
4. **Niezalogowany:** przycisk główny „Załóż konto i dołącz” → SC-02, przycisk drugorzędny „Mam konto — zaloguj się” → SC-01. Po zalogowaniu / rejestracji powrót tutaj i automatyczne dołączenie.

Uwaga dot. MC-02: nazwa listy i imię właściciela są pokazywane tylko dla ważnego linku.

## Components

| Component | Variant | Notes |
| --- | --- | --- |
| Button | główny, drugorzędny | |
| InlineAlert | błąd, informacja | |
| Loading | wskaźnik w przycisku / na ekranie | |

## States

| State | What the user sees | Trigger |
| --- | --- | --- |
| Empty | — | |
| Loading | „Sprawdzamy zaproszenie…” | Wejście z linku |
| Error — link nieważny | `h1` „Ten link nie działa”, tekst: „Zaproszenie wygasło, zostało już użyte albo unieważnione. Poproś właściciela listy o nowy link.” + „Przejdź do aplikacji” | Link użyty, > 7 dni, unieważniony (F-11, MC-02) |
| Error — limit | „Lista ma już 20 uczestników, więc nie możesz dołączyć. Daj znać właścicielowi listy.” | F-12 |
| Info — już na liście | „Już jesteś na tej liście.” + „Otwórz listę” → SC-06 | Uczestnik otwiera link (F-12) |
| Info — własna lista | „To Twoja lista — nie musisz dołączać.” + „Otwórz listę” | Właściciel otwiera link (F-12) |
| Error — sieć | „Brak połączenia. Sprawdź internet i spróbuj ponownie.” | |
| Success | Przejście do SC-06 z komunikatem „Dołączyłeś(-aś) do listy „<nazwa>”.” | Dołączenie |
| No permission | — (publiczny) | |

## Interactions

- „Dołącz do listy” → dołączenie → SC-06.
- „Załóż konto i dołącz” → SC-02 z kontekstem zaproszenia → po rejestracji automatyczne dołączenie → SC-06 (F-01, F-12).
- „Mam konto — zaloguj się” → SC-01 z kontekstem → po zalogowaniu powrót i automatyczne dołączenie → SC-06.
- „Nie teraz” → SC-05; link pozostaje ważny.

## Copy

| Key | Text |
| --- | --- |
| title | Zaproszenie do listy |
| body | {imię} zaprasza Cię do listy „{nazwa}”. |
| join | Dołącz do listy |
| later | Nie teraz |
| registerJoin | Załóż konto i dołącz |
| loginJoin | Mam konto — zaloguj się |
| checking | Sprawdzamy zaproszenie… |
| invalid.title | Ten link nie działa |
| invalid.body | Zaproszenie wygasło, zostało już użyte albo unieważnione. Poproś właściciela listy o nowy link. |
| invalid.cta | Przejdź do aplikacji |
| limit | Lista ma już 20 uczestników, więc nie możesz dołączyć. Daj znać właścicielowi listy. |
| already | Już jesteś na tej liście. |
| own | To Twoja lista — nie musisz dołączać. |
| open | Otwórz listę |
| joined | Dołączyłeś(-aś) do listy „{nazwa}”. |

## Accessibility

- Fokus startowy na `h1` (ekran zmienia treść po sprawdzeniu linku — wynik ogłaszany).
- Jeden przycisk główny na stan.
- Sprawdzone z tabelą „Design”: nie trzeba ponownie wpisywać danych po powrocie z SC-01/SC-02 (3.3.7).
