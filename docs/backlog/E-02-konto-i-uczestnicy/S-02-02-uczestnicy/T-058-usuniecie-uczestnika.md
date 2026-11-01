---
id: T-058
title: Usunięcie uczestnika przez właściciela
epic: E-02
story: S-02-02
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-056, T-057, T-063]
size: M                # S | M (L must be split)
layers: [backend, web]
requirements: [F-13, N-04]
threats: [TH-01, TH-02, TH-04, TH-21]
screens: [SC-07, SC-06, SC-05]
---

# T-058 Usunięcie uczestnika przez właściciela

## Goal

Właściciel usuwa uczestnika z SC-07 po potwierdzeniu. Usunięty natychmiast traci dostęp: jego otwarte SC-06 / SC-07 wraca na SC-05 z komunikatem, nie dostaje dalszych zmian, a jego zapisy są odrzucane (MC-03). Dodane przez niego pozycje zostają.

## Demo

1. Ania (właściciel) i Tomek (uczestnik) mają otwartą „Dom” w dwóch przeglądarkach.
2. Ania: SC-07 → „Usuń Tomek z listy” → „Usunąć Tomek z listy? Straci do niej dostęp od razu. Dodane przez niego pozycje zostaną.” → „Usuń”.
3. U Tomka od razu: SC-05 z „Lista „Dom” została usunięta albo nie masz już do niej dostępu.”; „Dom” znika z jego list.
4. U Ani: Tomek znika z „Na liście”, fokus na następnym wierszu; pozycje Tomka zostają z „dodał(a) Tomek”.

## Context

- BRD: F-13 — „właściciel usuwa uczestnika; uczestnik z otwartą listą natychmiast traci dostęp (MC-03); pozycje dodane przez usuniętego zostają”.
- Architektura: `api.md` (`DELETE /api/v1/lists/:listId/members/:userId` → 204; `access.revoked` do usuniętego; 403 `owner_only`, 404), `architecture.md` „Zmiany na żywo” (`revoke` w tej samej operacji, przed kolejnym zdarzeniem; `members.changed`, `lists.changed`), log `security` („usunięcie uczestnika”), TH-01, TH-02, TH-04.
- Design: SC-07 — „Usuń” (nazwa dostępna „Usuń {imię} z listy”), ConfirmDialog (fokus startowy na „Anuluj”), fokus po usunięciu na następnym wierszu albo nagłówku sekcji, stan Offline („Usuń” nieaktywny); SC-06 / SC-05 stan „Dostęp odebrany” (z E-01).
- Depends on: T-056 — `revoke` bez wyścigu z `subscribe`; T-057 — sekcja „Na liście” i `GET …/members`; T-063 — stan offline (hook i pasek), żeby „Usuń” był nieaktywny bez sieci.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given właściciel i uczestnik U, when `DELETE /api/v1/lists/:listId/members/:U`, then 204, członkostwo usunięte w jednej operacji z `revoke(U, listId)`, `members.changed` do listy, `lists.changed` do U i właściciela; pozycje dodane / odhaczone przez U zostają z jego imieniem. — verified by: test integracyjny
- [ ] AC2: Given SC-07 właściciela, when „Usuń {imię} z listy” → ConfirmDialog → „Usuń”, then wiersz znika, fokus na następnym wierszu (ostatni → nagłówek „Na liście”), licznik maleje, komunikat `polite`; „Anuluj” zamyka okno z fokusem z powrotem na „Usuń”. Podwójne „Usuń” = jedno żądanie (T-020). — verified by: test komponentu (MSW)
- [ ] AC3: Given U ma otwarte SC-06 lub SC-07 tej listy, when właściciel go usuwa, then U w ≤ 5 s jest na SC-05 z komunikatem „Lista „<nazwa>” została usunięta albo nie masz już do niej dostępu.”, a lista znika z jego SC-05. — verified by: E2E Playwright (dwa konteksty)
- [ ] AC4: Given brak połączenia, then „Usuń” przy uczestnikach nieaktywny (`aria-disabled`, T-015); given błąd serwera, then ConfirmDialog pokazuje „Nie udało się usunąć. Spróbuj ponownie.” (copy spoza SC-07, zatwierdzone przez właściciela 2026-11-01 — dopisać do Copy SC-07) i zostaje otwarty. — verified by: test komponentu
- [ ] AC5: Given SC-07 z otwartym ConfirmDialog i po usunięciu, when E2E je odwiedza, then axe bez naruszeń. — verified by: E2E + axe
- [ ] SEC1 (TH-04): Given U z aktywną subskrypcją listy, when właściciel go usuwa, then U dostaje `access.revoked`, kolejne zdarzenie listy do niego nie dociera, a jego `PATCH`/`POST` na pozycjach i `GET` listy zwracają 404. — verified by: test integracyjny WS + HTTP
- [ ] SEC2 (TH-02): Given uczestnik, when `DELETE …/members/<inny uczestnik>` lub `…/members/<właściciel>`, then 403 `owner_only` i nic się nie zmienia. — verified by: test integracyjny
- [ ] SEC3 (TH-01): Given domownik bez dostępu do listy A, when `DELETE /api/v1/lists/<A>/members/<U>`, then 404; anonim 401; `userId` osoby spoza listy albo właściciela przez właściciela → 404, bez zmian. — verified by: test integracyjny autoryzacji
- [ ] SEC4 (TH-21): Given usunięcie uczestnika, then log `security` zawiera zdarzenie `member_removed` z `listId`, `userId` właściciela i usuniętego, bez imion i e-maili. — verified by: test logów

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API `DELETE /api/v1/lists/:listId/members/:userId` i WebSocket `/api/v1/live` (`fastify.inject`, klient `ws`)
- ekran SC-07 z MSW
- przeglądarka (Playwright, dwa konteksty)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | właściciel usuwa uczestnika: 204, członkostwo usunięte, pozycje zostają z imieniem | integration | Vitest + Testcontainers | AC1 |
| 2 | usunięty dostaje `access.revoked`, potem nic; zapisy 404 | integration | Vitest + Testcontainers + `ws` | SEC1 |
| 3 | `members.changed` i `lists.changed` do właściwych osób | integration | Vitest + Testcontainers + `ws` | AC1 |
| 4 | uczestnik 403; obcy 404; anonim 401; zły `userId` 404 | integration | Vitest + Testcontainers | SEC2, SEC3 |
| 5 | log `security` `member_removed` bez danych osobowych | integration | Vitest | SEC4 |
| 6 | SC-07: ConfirmDialog, fokus po usunięciu i po „Anuluj”, błąd, offline, jedno żądanie | component | Vitest + RTL + MSW | AC2, AC4 |
| 7 | E2E MC-03: usunięty z otwartą listą trafia na SC-05; axe | E2E | Playwright (dwa konteksty) + axe | AC3, AC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** API tylko w testach komponentów; baza prawdziwa.

**Client state during writes:** usunięcie — odpowiedź opóźniona (właściciel w tym czasie usuwa drugą osobę: oba wiersze znikają poprawnie, fokus nie spada na `body`), odpowiedź utracona po zapisie (ponowienie dostaje 404 → wiersz i tak znika, bez komunikatu błędu), uczestnik w międzyczasie sam odszedł (`members.changed`) — dialog dla nieistniejącego wiersza zamyka się bez błędu.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** usunięcie uczestnika, który w tej chwili odhacza pozycję (zapis 404, komunikat na jego ekranie); usunięcie przy 20 uczestnikach (ostrzeżenie limitu znika, „Utwórz link” aktywny); usunięty ponownie dołącza nowym linkiem; usunięty ma listę otwartą w dwóch kartach.
- **Design states:** SC-07 z dialogiem, po usunięciu, błąd, offline; SC-05 usuniętego z komunikatem.
- **Platforms / devices:** właściciel na komputerze, usunięty na telefonie (Safari, Chrome).
- **Accessibility:** fokus po usunięciu (następny wiersz / nagłówek), dialog z klawiatury (Escape = Anuluj), komunikat u usuniętego ogłaszany.
- **Security / privacy:** MC-03 ręcznie: usunięty próbuje zapisu przez starą kartę, przez API z ciasteczkiem, przez WS `subscribe` — wszystko odrzucone; uczestnik próbuje usunąć innych (TH-02).
- **Regression:** J-04 (dołączenie, limit 20), J-05, SC-05 awatary i liczniki.

## Implementation notes

- Kolejność: transakcja usunięcia członkostwa → po commit `revoke` → `publish(members.changed)` → `notify(lists.changed)`; `revoke` przed jakimkolwiek kolejnym zdarzeniem listy (MC-03).
- Rozważ wspólną funkcję „odbierz dostęp” dla T-058, T-059 i T-062 (usunięcie konta wypisuje z cudzych list).

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
