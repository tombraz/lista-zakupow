---
id: T-054
title: "Nowe hasło z linku; reset kończy wszystkie sesje"
epic: E-02
story: S-02-01
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-053]
size: M                # S | M (L must be split)
layers: [backend, web]
requirements: [F-03, N-04]
threats: [TH-10, TH-21, TH-28]
screens: [SC-03, SC-01]
---

# T-054 Nowe hasło z linku; reset kończy wszystkie sesje

## Goal

Link z maila otwiera SC-03 krok 2; domownik ustawia nowe hasło i loguje się nim na SC-01. Link działa raz i przez 1 godzinę, a reset kończy wszystkie sesje konta razem z ich połączeniami na żywo.

## Demo

1. Poproś o reset (T-053), otwórz link z Mailpit → „Ustaw nowe hasło”, fokus w polu hasła.
2. Wpisz „krótkie” → „Hasło musi mieć co najmniej 8 znaków”. Wpisz poprawne → „Zapisz hasło” → SC-01 z „Hasło zmienione. Zaloguj się nowym hasłem.”
3. Stare hasło nie działa, nowe działa.
4. Ten sam link drugi raz → „Ten link wygasł albo został już użyty.” + „Wyślij nowy link” → krok 1.
5. Druga przeglądarka zalogowana na to konto z otwartą listą: po resecie przestaje dostawać zmiany i przy następnej akcji trafia na SC-01 (T-018).

## Context

- BRD: F-03 — „link resetu jednorazowy i ważny 1 godzinę; nowe hasło ma co najmniej 8 znaków; użyty lub wygasły link nie pozwala ustawić hasła”.
- Architektura: `api.md` „Konta” (`POST /api/auth/reset-password { token, newPassword }` → 200; 400 `invalid_token`, 400 `validation_failed`), `threat-model.md` TH-10 („reset unieważnia wszystkie sesje”), TH-28 („`closeSession` na każdej ścieżce końca sesji”), moduł `na-zywo` (`Live.closeSession`), log `security` („zmiana hasła”, `architecture.md` „Obserwowalność”).
- Design: SC-03 krok 2 — stany Error — link nieważny, Error — walidacja, Error — sieć, Loading, Success — krok 2; Accessibility (fokus startowy na polu, menedżer haseł); SC-01 komunikat sukcesu.
- Depends on: T-053 — trasa `/reset-hasla`, `Mailer`, prośba o reset i token Better Auth.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given ważny token, when `POST /api/auth/reset-password { token, newPassword }` z hasłem ≥ 8 znaków, then 200; logowanie starym hasłem daje 401 `invalid_credentials`, nowym — 200. — verified by: test integracyjny
- [ ] AC2: Given hasło krótsze niż 8 znaków, then 400 `validation_failed`, hasło bez zmian, token dalej ważny; SC-03 pokazuje błąd pod polem (powiązany z polem, fokus na polu). — verified by: test integracyjny + test komponentu
- [ ] AC3: Given SC-03 z `?token=`, when strona się otwiera, then krok 2 z fokusem w polu „Nowe hasło” (`autocomplete="new-password"`, „Pokaż”); po zapisie przejście na SC-01 (`replace`, token nie zostaje w historii) z komunikatem sukcesu `role="status"`. — verified by: test komponentu (MSW)
- [ ] AC4: Given token użyty albo starszy niż 1 h (zegar), when wysyłam nowe hasło, then 400 `invalid_token`; SC-03 zamiast formularza pokazuje „Ten link wygasł albo został już użyty.” + „Wyślij nowy link” (→ krok 1, fokus na nagłówku). — verified by: test integracyjny + test komponentu
- [ ] AC5: Given SC-03 krok 2 w każdym stanie (formularz, walidacja, link nieważny, sieć) i SC-01 z komunikatem sukcesu, when E2E je odwiedza, then axe bez naruszeń. — verified by: E2E Playwright + axe (pełna ścieżka z mailem z Mailpit)
- [ ] SEC1 (TH-10): Given konto z dwiema sesjami, when reset się udaje, then obie sesje są usunięte (żądanie z każdą daje 401), a dwa równoległe resety tym samym tokenem kończą się jednym sukcesem. — verified by: test integracyjny
- [ ] SEC2 (TH-28): Given otwarte połączenie WS sesji tego konta (subskrypcja listy), when reset się udaje, then gniazdo jest zamknięte (1008), kolejne zdarzenie listy do niego nie dociera, a nowe połączenie z tą sesją jest odrzucone. — verified by: test integracyjny WS (`live.*`)
- [ ] SEC3 (TH-21): Given reset, when API loguje żądanie, then ścieżka i treść nie zawierają tokenu ani hasła (token zredagowany także w `?token=` adresu strony serwowanej przez API); udany reset zostawia zdarzenie `password_reset` w logu `security` z `userId`, bez e-maila. — verified by: test logów

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API `POST /api/auth/reset-password` przez `fastify.inject`, token z przechwytującego `Mailer`
- WebSocket `/api/v1/live` (klient `ws`)
- ekrany SC-03 (krok 2) i SC-01 z MSW
- przeglądarka (Playwright) z Mailpit dla pełnej ścieżki

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | reset ważnym tokenem: stare hasło 401, nowe 200 | integration | Vitest + Testcontainers | AC1 |
| 2 | za krótkie hasło: 400, token dalej ważny | integration | Vitest + Testcontainers | AC2 |
| 3 | token użyty, wygasły (zegar 1 h + 1 s), równoległe użycie | integration | Vitest + Testcontainers | AC4, SEC1 |
| 4 | reset usuwa wszystkie sesje konta | integration | Vitest + Testcontainers | SEC1 |
| 5 | reset zamyka gniazda WS sesji konta; ponowne połączenie odrzucone | integration | Vitest + Testcontainers + `ws` | SEC2 |
| 6 | logi bez tokenu i hasła; zdarzenie `password_reset` w `security` | integration | Vitest | SEC3 |
| 7 | SC-03 krok 2: fokus startowy, walidacja, link nieważny → krok 1, sieć, sukces → SC-01 (`replace`) | component | Vitest + RTL + MSW | AC2–AC4 |
| 8 | E2E: prośba → mail w Mailpit → nowe hasło → logowanie; ponowne użycie linku; axe | E2E | Playwright + axe | AC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** `Mailer` (przechwytujący) w testach API, zegar. W E2E prawdziwy Mailpit (API Mailpita do odczytu maila).

**Client state during writes:** zapis hasła — odpowiedź opóźniona (podwójne kliknięcie = jedno żądanie, T-020), utracona po zapisie (ponowna próba dostaje `invalid_token`; ekran mówi, że link nie działa — zapisać w QA, czy to akceptowalne, propozycja: komunikat kroku 2 z „Wyślij nowy link” wystarcza).

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** link otwarty w aplikacji pocztowej na telefonie (przeglądarka wbudowana); link ucięty o znak; hasło z polskimi znakami i spacjami; dwa linki z dwóch próśb — który działa po użyciu jednego; reset na koncie, które w międzyczasie usunięto.
- **Design states:** SC-03 krok 2: formularz, Loading, walidacja, link nieważny, sieć; SC-01 sukces.
- **Platforms / devices:** iPhone (Safari) i Android (Chrome) z prawdziwego maila (lokalnie Mailpit w sieci LAN albo na staging po T-055); komputer; 200 %.
- **Accessibility:** fokus w polu hasła po wejściu z linku; menedżer haseł proponuje silne hasło; błąd ogłaszany; „Pokaż” działa z klawiatury.
- **Security / privacy:** TH-10 / TH-28 — zalogowany drugi telefon z otwartą listą traci dostęp po resecie; token nie trafia do logów ani do `Referer` (`Referrer-Policy: no-referrer`); użycie tokenu po 1 h.
- **Regression:** J-01, wylogowanie zamyka WS (T-009, TH-17), wygasła sesja przenosi na SC-01 (T-018).

## Implementation notes

- Better Auth: `revokeSessionsOnPasswordReset: true` usuwa sesje w bazie; zamknięcie gniazd to osobny krok (`Live` nie zna bazy) — potrzebne „zamknij wszystkie połączenia użytkownika” albo `closeSession` dla każdej usuniętej sesji; to samo przyda się w T-062.
- Token w adresie strony (`/reset-hasla?token=`): web czyta go przy wejściu i usuwa z paska adresu (`replace`) przed wysłaniem formularza; API serwuje web, więc redakcja logów obejmuje ten adres (wzorem T-051, na dopasowanej trasie, TH-26).
- Zdarzenie `security` nazwać spójnie z istniejącymi (T-041).

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
