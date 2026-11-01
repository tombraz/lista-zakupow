---
id: T-063
title: "Pasek „Brak połączenia”, blokada zapisów i aktualny stan po powrocie"
epic: E-02
story: S-02-04
status: in-qa                 # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given zdarzenie `offline` przeglądarki albo brak ponga przez 10 s (zegar), when użytkownik jest na SC-05, SC-06, SC-07 lub SC-09, then pod AppBar pojawia się OfflineBanner „Brak połączenia. Zmiany nie są zapisywane.” (`role="status"`, ogłoszony), który przesuwa treść; given powrót połączenia (gniazdo otwarte i `subscribed`), then pasek znika, a zniknięcie jest ogłoszone. — verified by: test komponentu z podstawionym gniazdem i zegarem
- [x] AC2: Given offline, then SC-05 „+ Nowa lista”, SC-06 AddBar, checkboxy, edycja i „Usuń wszystkie kupione”, SC-07 „Utwórz link zaproszenia” i „Unieważnij” — nieaktywne (`aria-disabled`, fokus zostaje na przycisku); SC-07 „Kopiuj” (bez zapisu) i SC-09 „Wyloguj się” działają. — verified by: testy komponentów SC-05, SC-06, SC-07, SC-09
- [x] AC3: Given zapis wysłany tuż przed zerwaniem, when odpowiedź nie przychodzi, then UI nie pokazuje zmiany jako zapisanej (pozycja nie pojawia się / checkbox wraca), a błąd sieci pokazuje istniejący komunikat ekranu; nic nie trafia do kolejki. — verified by: test komponentu (MSW z błędem sieci)
- [x] AC4: Given otwarta SC-06 i przerwa, w czasie której inna osoba zmieniła listę, when połączenie wraca, then klient ponownie subskrybuje listę i pobiera jej stan (oraz SC-05 / SC-07, jeśli otwarte), a ekran pokazuje zmiany z przerwy bez odświeżania; fokus nie spada na `body`. — verified by: test komponentu + E2E (Playwright `context.setOffline`)
- [x] AC5: Given każdy z ekranów w stanie Offline, when E2E je odwiedza, then axe bez naruszeń (kontrast paska `surface.inverse`); pasek nie zasłania treści przy 320 px i 200 %. — verified by: E2E + axe

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

- [x] All tests in the TDD plan written test-first and passing (wyjątki z próbą „gryzienia” w Evidence)
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

### Co zbudowano

- `LiveSocket` (`apps/web/src/live/liveSocket.ts`): stan połączenia `isOnline()` / `onStatus`. Offline = zdarzenie `offline` okna albo zerwane gniazdo (zamknięcie, cisza 25 + 10 s). Online wraca, gdy gniazdo jest otwarte i serwer potwierdził (`subscribed` albo `error`) każdą listę subskrybowaną przy otwarciu. `offline` zamyka gniazdo od razu (gniazdo potrafi wisieć „otwarte” w trybie samolotowym), bez sieci nie ma prób ponownego połączenia, `online` łączy od razu (backoff od zera). Przed pierwszym połączeniem stan to `online`, więc pasek nie miga przy wejściu.
- `useConnection()` (`live/useConnection.ts`) → `{ online }`. Poza `LiveProvider` zawsze `online`, więc SC-01–SC-04 i SC-08 bez paska.
- `OfflineBanner` (`components/OfflineBanner/`) w `AppBar` (SC-05, SC-06, SC-07, SC-09): w przepływie pod nagłówkiem, `surface.inverse` / `text.on-inverse`. Region `role="status"` jest zawsze w drzewie; po zniknięciu paska zostaje ukryty tekst „Połączenie przywrócone.”, żeby zniknięcie też zostało ogłoszone.
- `Button` dostał prop `writes`: bez połączenia `aria-disabled`, `aria-describedby` = pasek, kliknięcie i niejawne wysłanie formularza nic nie robią, fokus zostaje. Używają go: SC-05 „+ Nowa lista” i „Utwórz” w formularzu, SC-06 AddBar „Dodaj” (plus straż w `onSubmit` AddBar), „Usuń wszystkie kupione”, zapis i usunięcie w arkuszu edycji, „Zapisz” przy zmianie nazwy, potwierdzenie w `ConfirmDialog`, SC-07 „Utwórz link zaproszenia” i „Unieważnij”. `ItemRow`: przycisk nazwy (edycja) i checkbox nieaktywne offline. Pola tekstowe zostają edytowalne: wpisany tekst nie ginie (design-system.md AddBar: „brak połączenia (przycisk nieaktywny)”).
- `queryClient.ts`: zapisy `networkMode: "always"`. Domyślny tryb TanStack („online”) wstrzymywał zapis po zdarzeniu `offline` i wysyłał go po powrocie, czyli działał jak kolejka offline (poza zakresem; AC3). Przykład: „Wyloguj się” offline nie robiło nic, a po powrocie sieci wylogowywało.
- SC-06: pusta lista dostaje `tabIndex=0` na `main` (`scrollFocus`). Przy 320 px, 200 % i pasku `main` się przewija, a bez niczego fokusowalnego axe zgłaszał `scrollable-region-focusable` (WCAG 2.1.1).
- Test helpers: `test/live.ts` `browserGoes()`. `test/setup.ts` przywraca `onlineManager.setOnline(true)` po każdym teście, bo `onlineManager` jest globalny, a po odmontowaniu nie słucha już `online`. `renderApp` używa `createQueryClient()` (bez ponawiania zapytań), więc testy mają ten sam `networkMode` zapisów co aplikacja. `e2e/lists.ts` `api().patch`.
- SC-05 `ListsScreen.live.test.tsx`: zapytanie o region ogłoszeń zawężone do `main`, bo pasek to drugi region `status` bez nazwy. Zmiana dotyczy selektora, asercje bez zmian.
- SC-07: `InvitationFailure` wydzielone z `Invitations` (limit 80 linii funkcji po dodaniu `writes`).

### Testy z planu (red → green)

| # | Test | Red | Teraz |
| --- | --- | --- | --- |
| 1 | `live/connection.test.tsx` „appears when the browser goes offline and disappears once the socket is open and subscribed” | `Unable to find an element with the text: Brak połączenia. Zmiany nie są zapisywane.` | pass |
| 2 | `connection.test.tsx` „appears when no ping comes 10 s after the expected one (25 s), on SC-05 too” | Uwaga: napisany po kodzie z testu 1 (oznaczanie zerwania było już w `reconnect`). Sprawdzenie, że test gryzie: bez `markDropped()` w `reconnect` → `Unable to find an element with the text: Brak połączenia…`; kod przywrócony | pass |
| 3 | `live/offlineWrites.test.tsx` SC-05 „+ Nowa lista” | `expect(element).toHaveAttribute("aria-disabled", "true")` — Received: brak | pass |
| 3 | SC-06 AddBar, checkboxy, edycja, „Usuń wszystkie kupione” | `toHaveAttribute("aria-disabled", "true")` — brak (AddBar) | pass |
| 3 | SC-07 „Utwórz link zaproszenia”, „Unieważnij”; „Kopiuj” działa | `toHaveAttribute("aria-disabled", "true")` — brak | pass |
| 3 | SC-09 „Wyloguj się” działa offline, żądanie od razu | `Unable to find role="heading" and name "Zaloguj się"` (zapis wstrzymany przez `onlineManager`, czyli kolejka) | pass |
| 4 | `live/offlineInFlight.test.tsx` dodanie i odhaczenie zerwane w locie (MSW `HttpResponse.error()` po zdarzeniu `offline`) | Przeszły od razu: brak optymistycznych aktualizacji od T-006/T-007. Sprawdzenie, że testy gryzą: `mutations: { networkMode: "online", retry: 1 }` → oba padają (drugi zapis wysłany po `online`); kod przywrócony | pass |
| 5 | `connection.test.tsx` „SC-06: subscribes again and shows what others changed during the break, focus stays” | Przeszedł od razu: wymuszone zamknięcie gniazda przy `offline` było już w kodzie z testu 1. Sprawdzenie: bez zamknięcia gniazda w `goOffline` → `expected [ { type: 'subscribe', …(1) } ] to have a length of 2 but got 1`; kod przywrócony | pass |
| 5 | `connection.test.tsx` „SC-07: after a silent drop (no browser event) fetches the participants again” | Odświeżenie po ponownym połączeniu istniało od T-009; nowe są pasek i jego zniknięcie po `subscribed` | pass |
| 6 | `e2e/brak-polaczenia.spec.ts`: (a) przerwa u Tomka, zmiany Ani widoczne po powrocie; (b) stan Offline SC-06, SC-07, SC-05, SC-09 + axe, „Wyloguj się” aktywne; (c) 320 px i 200 %: pasek pod nagłówkiem, `main` pod paskiem, tekst nie ucięty, axe | Pierwsze uruchomienie: (c) axe `scrollable-region-focusable` na `<main>` pustej SC-06, czyli prawdziwy błąd, poprawiony przez `scrollFocus`; (b) krok SC-07 przed wczytaniem sekcji, poprawka w teście: czekanie na przycisk | pass, oba projekty (telefon, komputer) |

Stabilność E2E: `brak-polaczenia.spec.ts` uruchomiony około 25 razy (pełny plik i `--repeat-each 6`). W 3 przebiegach na Windows (test a) pasek nie zniknął w 10 s po `setOffline(false)`. Według `api.log` upgrade WebSocket przyszedł 10 s po `online`, a GET listy po istniejącym połączeniu przyszedł od razu. Logi z instrumentacją w udanych przebiegach: `online` → `open()` → `opened` w ~20 ms. Wniosek: na Windows nowe połączenie TCP z API czasem czeka ~10 s (jak pułapka „druga strona w E2E na Windows”). Czas pojawienia się paska zostaje 10 s (`SOON`), czas powrotu dostał zapas 20 s (`BACK`), bo AC nie określa czasu powrotu.

### Komendy (ten przebieg)

- `pnpm check`: exit 0 (format, lint, typecheck, jscpd 0 klonów, depcruise 0 naruszeń, design-check, backlog-check, workflow-check, vitest 117 plików / 824 testy, mobile 10 testów).
- `pnpm test:e2e`: 64 passed (4.9 min), w tym J-05 i `rozmiar-tekstu.spec.ts`.

### Kryteria

- AC1: testy 1 i 2 (`role="status"`, pojawienie na `offline` i po ciszy 35 s, zniknięcie dopiero po `subscribed`, ogłoszenie „Połączenie przywrócone.”); E2E (c): pasek przesuwa treść.
- AC2: `offlineWrites.test.tsx` (4 testy: `aria-disabled`, opis = pasek, fokus zostaje, zero żądań zapisu; „Kopiuj” i „Wyloguj się” działają); E2E (b).
- AC3: `offlineInFlight.test.tsx` (pozycja się nie pojawia, checkbox wraca, „Brak połączenia. Sprawdź internet i spróbuj ponownie.”, brak ponownego wysłania po `online`); SC-09 test (zapis nie jest wstrzymywany).
- AC4: test 5 (ponowna subskrypcja, nowy GET, „Masło” i „Kupione (1)”, fokus zostaje w polu „Co kupić?”); SC-07 po cichym zerwaniu; SC-05 odświeżane przez istniejące `onReconnect` w `LiveProvider`; E2E (a).
- AC5: E2E (b) axe na SC-06, SC-07, SC-05, SC-09 offline, oba viewporty; (c) 320 px i 200 %.

### Decyzje do wglądu (QA / właściciel)

- **Tekst „Połączenie przywrócone.”** (ukryty, tylko dla czytnika) nie występuje w tabelach „Copy” ekranów. Design wymaga, żeby zniknięcie paska było ogłaszane, ale nie podaje tekstu. Gdy właściciel zechce inny, wystarczy zmiana w `components/OfflineBanner/OfflineBanner.tsx`.
- **„Brak ponga przez 10 s”:** protokół nie ma pingu od klienta (`LiveClientMessage`: tylko `subscribe` / `unsubscribe` / `pong`). Klient uznaje zerwanie, gdy przez 10 s po spodziewanym pingu serwera (25 s) nic nie przyjdzie, czyli łącznie 35 s ciszy (`LIVE_LIMITS`). Tryb samolotowy i DevTools offline dają zdarzenie `offline`, więc pasek pojawia się od razu. „Wi-Fi bez internetu” pokazuje pasek po ≤ 35 s od ostatniego pingu.
- Krótkie zerwanie przez serwer (restart API) pokazuje pasek do ponownego połączenia (~1 s). Bez wygładzania: AC wymaga paska przy zerwaniu.
- Po powrocie lista jest pobierana dwa razy: `refetchOnReconnect` TanStack przy `online` plus `onReconnect` gniazda. Wynik jest ten sam, to tylko jedno żądanie więcej.

### Propozycje do „Pułapek” / „Konwencji” web.md (bez edycji)

- Każdy przycisk zapisu dostaje `<Button writes>`; T-058, T-059, T-061, T-062 („Usuń”, „Opuść listę”, „Zapisz imię”, „Usuń konto”) używają tego propa. Element zapisu poza `Button` korzysta z `useConnection()` jak `ItemRow`.
- Test, który wysyła `offline`, polega na resecie `onlineManager` w `test/setup.ts`. Bez niego kolejne testy pliku mają wstrzymane zapytania i nic się nie renderuje.
- E2E na Windows: nowe połączenie (WebSocket po `setOffline(false)`) potrafi czekać ~10 s; asercje powrotu z zapasem.

### Layer guide (Step 8b)

`docs/architecture/layers/web.md` „Gdzie jest kod”: `queryClient.ts` (zapisy `networkMode: "always"`), `live/` (`isOnline`, `onStatus`, `useConnection`), Button `writes`, OfflineBanner, ItemRow, `test/live.ts` `browserGoes`, `setup.ts` / `renderApp`, `e2e/brak-polaczenia.spec.ts`, `e2e/lists.ts` `api().patch`.
