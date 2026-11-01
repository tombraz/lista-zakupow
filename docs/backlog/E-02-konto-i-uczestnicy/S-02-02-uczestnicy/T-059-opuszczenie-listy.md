---
id: T-059
title: Opuszczenie listy przez uczestnika
epic: E-02
story: S-02-02
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-056, T-057, T-063]
size: S                # S | M (L must be split)
layers: [backend, web]
requirements: [F-13, N-04]
threats: [TH-01, TH-04]
screens: [SC-07, SC-05]
---

# T-059 Opuszczenie listy przez uczestnika

## Goal

Uczestnik opuszcza listę z SC-07 po potwierdzeniu: lista znika z jego SC-05, zmiany przestają do niego docierać (także w innych jego kartach), a jego pozycje zostają. Właściciel nie może opuścić własnej listy.

## Demo

1. Tomek (uczestnik „Dom”): SC-07 → „Opuść listę” → „Opuścić listę „Dom”? Żeby wrócić, potrzebujesz nowego zaproszenia.” → „Opuść”.
2. Tomek na SC-05 bez „Dom”. U Ani (SC-07 otwarte) Tomek znika w ≤ 5 s; jego pozycje zostają.
3. Druga karta Tomka z „Dom” wraca na SC-05 z komunikatem o braku dostępu.

## Context

- BRD: F-13 — „uczestnik opuszcza listę po potwierdzeniu; lista znika z jego list, zmiany przestają docierać; właściciel nie może opuścić własnej listy; pozycje zostają”.
- Architektura: `api.md` (`POST /api/v1/lists/:listId/leave` → 204; 403 `owner_cannot_leave`, 404), `revoke` + `members.changed` + `lists.changed`, TH-01, TH-04.
- Design: SC-07 — „Opuść listę” (niebezpieczny-tekstowy, tylko uczestnik), ConfirmDialog (fokus startowy na „Anuluj”), stan Offline; SC-05.
- Depends on: T-056 — `revoke` bez wyścigu; T-057 — widok uczestnika SC-07; T-063 — stan offline.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given uczestnik, when `POST /api/v1/lists/:listId/leave`, then 204, członkostwo usunięte, `revoke` dla wszystkich jego połączeń, `members.changed` do listy, `lists.changed` do niego i właściciela; jego pozycje zostają z imieniem. — verified by: test integracyjny
- [ ] AC2: Given właściciel, when `POST …/leave`, then 403 `owner_cannot_leave`, nic się nie zmienia; SC-07 właściciela nie ma „Opuść listę”. — verified by: test integracyjny + test komponentu
- [ ] AC3: Given SC-07 uczestnika, when „Opuść listę” → ConfirmDialog z nazwą listy → „Opuść”, then przejście na SC-05 (`replace`, wstecz nie wraca na listę) bez tej listy; „Anuluj” wraca z fokusem na „Opuść listę”; błąd serwera — komunikat w oknie, okno zostaje; offline — przycisk nieaktywny. — verified by: test komponentu (MSW)
- [ ] AC4: Given druga karta uczestnika z otwartym SC-06 tej listy, when wychodzi z listy w pierwszej, then druga karta w ≤ 5 s jest na SC-05 z komunikatem o braku dostępu. — verified by: E2E Playwright (dwie karty)
- [ ] AC5: Given ConfirmDialog i SC-05 po wyjściu, when E2E je odwiedza, then axe bez naruszeń. — verified by: E2E + axe
- [ ] SEC1 (TH-04): Given uczestnik po wyjściu, when następne zdarzenie listy, then do żadnego jego połączenia nie dociera; zapis i odczyt listy → 404. — verified by: test integracyjny WS + HTTP
- [ ] SEC2 (TH-01): Given domownik bez dostępu do listy A, when `POST /api/v1/lists/<A>/leave`, then 404; anonim 401. — verified by: test integracyjny autoryzacji

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API `POST /api/v1/lists/:listId/leave` i WebSocket `/api/v1/live`
- ekran SC-07 (widok uczestnika) z MSW
- przeglądarka (Playwright)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | uczestnik wychodzi: 204, członkostwo usunięte, pozycje zostają | integration | Vitest + Testcontainers | AC1 |
| 2 | po wyjściu brak zdarzeń; zapis i odczyt 404 | integration | Vitest + Testcontainers + `ws` | SEC1 |
| 3 | właściciel 403 `owner_cannot_leave`; obcy 404; anonim 401 | integration | Vitest + Testcontainers | AC2, SEC2 |
| 4 | SC-07: dialog, `replace` na SC-05, „Anuluj”, błąd, offline, brak przycisku u właściciela | component | Vitest + RTL + MSW | AC2, AC3 |
| 5 | E2E: wyjście, druga karta wraca na SC-05; axe | E2E | Playwright + axe | AC4, AC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** API tylko w testach komponentów; baza prawdziwa.

**Client state during writes:** wyjście — odpowiedź opóźniona (podwójne „Opuść” = jedno żądanie), utracona po zapisie (ponowienie 404 → przejście na SC-05 bez błędu), właściciel usuwa uczestnika w tym samym czasie (`access.revoked` przed odpowiedzią — jedno przejście na SC-05, jeden komunikat).

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** wyjście i ponowne dołączenie nowym linkiem; wyjście z listy, na której zostały tylko pozycje uczestnika; wyjście, gdy właściciel w tej chwili usuwa listę.
- **Design states:** SC-07 uczestnika z dialogiem, błąd, offline; SC-05 po wyjściu (także pusty stan, gdy to była jedyna lista).
- **Platforms / devices:** telefon (Safari, Chrome), komputer.
- **Accessibility:** dialog z klawiatury, fokus po powrocie na SC-05 (nagłówek, T-014).
- **Security / privacy:** po wyjściu stara karta, API i WS nie dają dostępu (TH-04); obca lista (TH-01).
- **Regression:** J-04, SC-05 (liczniki, awatary właściciela), T-058.

## Implementation notes

- Ta sama funkcja „odbierz dostęp” co w T-058 (członkostwo + `revoke` + zdarzenia).

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
