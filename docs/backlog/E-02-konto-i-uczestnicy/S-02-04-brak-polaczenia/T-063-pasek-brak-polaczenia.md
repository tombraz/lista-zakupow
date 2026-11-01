---
id: T-063
title: "Pasek „Brak połączenia”, blokada zapisów i aktualny stan po powrocie"
epic: E-02
story: S-02-04
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: []
size: M                # S | M (L must be split)
layers: [web]
requirements: [F-15, N-04, N-06]
threats: []
screens: [SC-05, SC-06, SC-07, SC-09]
---

# T-063 Pasek „Brak połączenia”, blokada zapisów i aktualny stan po powrocie

## Goal

Gdy połączenie zrywa się (przeglądarka offline albo brak ponga przez 10 s), SC-05, SC-06, SC-07 i SC-09 pokazują OfflineBanner „Brak połączenia. Zmiany nie są zapisywane.”, a akcje zapisu są nieaktywne. Po powrocie połączenia pasek znika, klient ponownie subskrybuje otwartą listę i pobiera jej aktualny stan.

## Demo

1. Ania i Tomek mają otwartą „Dom”. Tomek włącza tryb samolotowy: w ≤ 10 s pasek pod nagłówkiem, AddBar, checkboxy i edycja nieaktywne; lista w ostatnim znanym stanie.
2. W tym czasie Ania dodaje „Masło” i odhacza „Chleb”.
3. Tomek wyłącza tryb samolotowy: pasek znika (ogłoszone), „Masło” i odhaczony „Chleb” widoczne bez odświeżania.
4. To samo na SC-05 („+ Nowa lista” nieaktywny) i SC-07 / SC-09 (pasek; „Wyloguj się” działa).

## Context

- BRD: F-15 — „wyraźny komunikat „brak połączenia”; bez połączenia aplikacja nie pokazuje zmiany jako zapisanej; po powrocie widać aktualny stan listy”; tryb offline z kolejką poza zakresem.
- Architektura: `architecture.md` „Zmiany na żywo” (ping co 25 s; brak ponga przez 10 s = zerwane; OfflineBanner, zapisy wyłączone; po powrocie `subscribe` i `GET` listy), „bez optymistycznych aktualizacji”; TanStack Query (odświeżenie po powrocie połączenia, `tech-stack.md`).
- Design: OfflineBanner (`design-system.md`: pod paskiem nagłówka, tło `surface.inverse`, `role="status"`, pojawienie i zniknięcie ogłaszane, przesuwa treść); stany Offline: SC-05 („+ Nowa lista” nieaktywny, karty w ostatnim stanie), SC-06 (AddBar, checkboxy, edycja nieaktywne; po powrocie aktualny stan), SC-07 (przyciski nieaktywne), SC-09 („Zapisz imię”, „Usuń konto” nieaktywne — przyciski dochodzą w T-061, T-062; „Wyloguj się” działa).
- Existing code: `apps/web/src/live/` (`LiveProvider`, `liveSocket.ts`, `useLiveList`), `apps/web/src/queryClient.ts`, przyciski z `aria-disabled` (T-015), `useGuardedMutation`.
- Depends on: — (E-01).

## Acceptance criteria

Each criterion must fail before the work and pass after it.

UI tasks: every row of the "States" table of each touched screen that this task makes reachable is covered by a criterion. Wiersze Offline przycisków, których jeszcze nie ma (SC-07 „Usuń”, „Opuść listę”; SC-09 „Zapisz imię”, „Usuń konto”), obejmują T-058, T-059, T-061, T-062 przez hook stanu połączenia z tego tasku.

- [ ] AC1: Given zdarzenie `offline` przeglądarki albo brak ponga przez 10 s (zegar), when użytkownik jest na SC-05, SC-06, SC-07 lub SC-09, then pod AppBar pojawia się OfflineBanner „Brak połączenia. Zmiany nie są zapisywane.” (`role="status"`, ogłoszony), który przesuwa treść; given powrót połączenia (gniazdo otwarte i `subscribed`), then pasek znika, a zniknięcie jest ogłoszone. — verified by: test komponentu z podstawionym gniazdem i zegarem
- [ ] AC2: Given offline, then SC-05 „+ Nowa lista”, SC-06 AddBar, checkboxy, edycja i „Usuń wszystkie kupione”, SC-07 „Utwórz link zaproszenia” i „Unieważnij” — nieaktywne (`aria-disabled`, fokus zostaje na przycisku); SC-07 „Kopiuj” (bez zapisu) i SC-09 „Wyloguj się” działają. — verified by: testy komponentów SC-05, SC-06, SC-07, SC-09
- [ ] AC3: Given zapis wysłany tuż przed zerwaniem, when odpowiedź nie przychodzi, then UI nie pokazuje zmiany jako zapisanej (pozycja nie pojawia się / checkbox wraca), a błąd sieci pokazuje istniejący komunikat ekranu; nic nie trafia do kolejki. — verified by: test komponentu (MSW z błędem sieci)
- [ ] AC4: Given otwarta SC-06 i przerwa, w czasie której inna osoba zmieniła listę, when połączenie wraca, then klient ponownie subskrybuje listę i pobiera jej stan (oraz SC-05 / SC-07, jeśli otwarte), a ekran pokazuje zmiany z przerwy bez odświeżania; fokus nie spada na `body`. — verified by: test komponentu + E2E (Playwright `context.setOffline`)
- [ ] AC5: Given każdy z ekranów w stanie Offline, when E2E je odwiedza, then axe bez naruszeń (kontrast paska `surface.inverse`); pasek nie zasłania treści przy 320 px i 200 %. — verified by: E2E + axe

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- ekrany SC-05, SC-06, SC-07, SC-09 z MSW i podstawionym gniazdem na żywo (zegar dla pinga)
- przeglądarka (Playwright, `context.setOffline`, dwa konteksty)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `offline` przeglądarki → pasek; `online` + `subscribed` → brak paska | component | Vitest + RTL | AC1 |
| 2 | brak ponga 10 s → pasek (zegar) | component | Vitest + RTL | AC1 |
| 3 | SC-05, SC-06, SC-07, SC-09: akcje zapisu nieaktywne offline, wylogowanie działa | component | Vitest + RTL + MSW | AC2 |
| 4 | zapis zerwany w locie nie jest pokazany jako zapisany | component | Vitest + RTL + MSW | AC3 |
| 5 | powrót: ponowna subskrypcja i pobranie stanu | component | Vitest + RTL + MSW | AC4 |
| 6 | E2E: przerwa u jednej osoby, zmiany drugiej widoczne po powrocie; axe offline | E2E | Playwright (dwa konteksty) + axe | AC4, AC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodnika web oraz E2E web

**Mocks:** zegar, gniazdo na żywo i API w testach komponentów; w E2E prawdziwe API, offline przez Playwright.

**Client state during writes:** zapis w trakcie zerwania — odpowiedź nie przychodzi (AC3), odpowiedź przychodzi po powrocie (stan z serwera wygrywa, bez duplikatu — istniejące `id` klienta pozycji, F-15 w `architecture.md`), zmiana innej osoby w czasie przerwy (AC4).

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** krótkie zerwania (< 10 s) — czy pasek miga; uśpiony telefon i powrót po minutach; Wi-Fi bez internetu (przeglądarka „online”, brak ponga); staging po uśpieniu maszyny (pierwsze połączenie ~6–7 s — pasek nie powinien wisieć po udanym połączeniu); wiele kart.
- **Design states:** Offline na SC-05, SC-06, SC-07, SC-09; powrót.
- **Platforms / devices:** iPhone (Safari, tryb samolotowy), Android (Chrome), komputer (DevTools offline).
- **Accessibility:** czytnik ekranu ogłasza pojawienie i zniknięcie paska; nieaktywne przyciski osiągalne klawiaturą z wyjaśnieniem (pasek); powiększenie 200 %.
- **Security / privacy:** — (bez nowych danych); reconnect nie wysyła tokenu w URL (TH-16).
- **Regression:** J-05 (≤ 5 s), limity WS (połączenia na sesję przy częstych reconnectach, T-037), wygasła sesja → SC-01 (T-018).

## Implementation notes

- Jeden hook stanu połączenia (np. `useConnection()` → `online: boolean`) w `live`, używany przez ekrany i przez `Button` / pola; kolejne taski (T-058, T-059, T-061, T-062) go używają.
- Reconnect z wycofaniem (backoff) i limitem połączeń na sesję z T-037.
- Na SC-01–SC-04 i SC-08 pasek się nie pojawia (publiczne ekrany mają własny błąd sieci).

## Definition of done

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>
