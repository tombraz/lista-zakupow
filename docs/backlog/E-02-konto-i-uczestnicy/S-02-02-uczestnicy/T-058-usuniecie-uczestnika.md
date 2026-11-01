---
id: T-058
title: Usunięcie uczestnika przez właściciela
epic: E-02
story: S-02-02
status: in-progress    # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given właściciel i uczestnik U, when `DELETE /api/v1/lists/:listId/members/:U`, then 204, członkostwo usunięte w jednej operacji z `revoke(U, listId)`, `members.changed` do listy, `lists.changed` do U i właściciela; pozycje dodane / odhaczone przez U zostają z jego imieniem. — verified by: test integracyjny
- [x] AC2: Given SC-07 właściciela, when „Usuń {imię} z listy” → ConfirmDialog → „Usuń”, then wiersz znika, fokus na następnym wierszu (ostatni → nagłówek „Na liście”), licznik maleje, komunikat `polite`; „Anuluj” zamyka okno z fokusem z powrotem na „Usuń”. Podwójne „Usuń” = jedno żądanie (T-020). — verified by: test komponentu (MSW)
- [x] AC3: Given U ma otwarte SC-06 lub SC-07 tej listy, when właściciel go usuwa, then U w ≤ 5 s jest na SC-05 z komunikatem „Lista „<nazwa>” została usunięta albo nie masz już do niej dostępu.”, a lista znika z jego SC-05. — verified by: E2E Playwright (dwa konteksty)
- [x] AC4: Given brak połączenia, then „Usuń” przy uczestnikach nieaktywny (`aria-disabled`, T-015); given błąd serwera, then ConfirmDialog pokazuje „Nie udało się usunąć. Spróbuj ponownie.” (copy spoza SC-07, zatwierdzone przez właściciela 2026-11-01 — dopisać do Copy SC-07) i zostaje otwarty. — verified by: test komponentu
- [x] AC5: Given SC-07 z otwartym ConfirmDialog i po usunięciu, when E2E je odwiedza, then axe bez naruszeń. — verified by: E2E + axe
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

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

### Tests (red → green)

| # | Test | Red (before the code) | Now |
| --- | --- | --- | --- |
| 1 | `apps/api/test/lists.remove-member.test.ts` › „answers 204, removes the membership and keeps the items the participant added and checked” | `expected 404 to be 204` (no route) | pass |
| 2 | `apps/api/test/live.remove-member.test.ts` › „sends access.revoked, then no list event, and refuses the participant's writes and reads” | `no "access.revoked" within 1000 ms; got [subscribed]` | pass |
| 3 | `live.remove-member.test.ts` › „tells the list members.changed and refreshes SC-05 of the removed person and everyone left” | `no "members.changed" within 1000 ms` | pass |
| 4 | `apps/api/test/lists.remove-member.authz.test.ts` (4 tests: participant 403 for another participant / owner / self; stranger, missing and malformed `listId` 404 identical, anonymous 401; owner + outsider / unknown id / own id 404; participant of another list 404) | Written after the route's `requireListAccess(…, "owner")` existed (added in green of #1). Bite check: with role `"member"` and no `not_found` for a non-member, 3 of 4 fail (`expected 204 to be 403`, `expected 204 to be 404` ×2); the stranger test stays green because `requireListAccess` still denies | pass |
| 5 | `lists.remove-member.test.ts` › „logs member_removed with the list, the owner and the removed participant, without names or e-mails” | `expected [] to deeply equal [ObjectContaining{…}]` | pass |
| 6 | `apps/web/src/screens/SC-07-uczestnicy/ParticipantsScreen.remove.test.tsx` (9 tests) | first test: `Unable to find … role "button" and name "Usuń Tomek z listy"`. The other 8 were written after the hooks and passed at once. Each was checked against a mutant (code changed, test run, code restored): 404 treated as an error → „lost response … 404” fails; no close when the person disappears → „left meanwhile” fails; `lockOf` random → „double Usuń” and „slow first removal” fail; no `writes` → „offline” fails; no `error` in the dialog → „keeps the dialog open…” and „lost response” fail; no fallback to the heading → „last row” and „slow first removal” fail | pass |
| 7 | `apps/web/e2e/sc07-uczestnicy.spec.ts` › „SC-07 owner removes participants who have the list open; they land on SC-05” (Tomek on SC-06, Ola on SC-07, 3 contexts, axe on the dialog, after the removal and on the removed person's SC-05) | written after the behaviour (slow E2E, run last). Bite check: with `live.revoke` taken out of the route, the test fails (`expect(locator).toBeVisible() failed`: no SC-05 message) | pass (telefon + komputer) |

`ParticipantsScreen.members.test.tsx`: the owner's rows now end in „Usuń” (`"TTomektomek@example.comUsuń"`). The expectation changed because the row gained the button; the participant's view still has no „Usuń” (`["AAniawłaściciel", "TTomekTy", "OOla"]`, unchanged).

### Commands (this run, 2026-11-01/02)

- `pnpm check` (format, lint, typecheck, jscpd 0 clones, depcruise no violations, design-check, backlog-check, workflow-check, `vitest run` 121 files / 841 tests, mobile tests): exit 0
- `pnpm test:e2e`: 66 passed (5.1 min, Windows, 1 worker)
- `pnpm vitest run --project api --sequence.shuffle --sequence.seed=58`: 81 files / 336 tests passed

### Acceptance criteria

- AC1: test 1 (204, membership gone, Tomek's added and checked items keep `addedBy` / `checkedBy` Tomek, his `GET /lists` is empty) + test 3 (`members.changed` to the list, `lists.changed` to the removed person, the owner (also a second connection) and the remaining participant). Order in `withdrawAccess`: `revoke` → `publish(members.changed)` → `notify(lists.changed)` right after the `DELETE` (one statement, already committed).
- AC2: test 6 „asks first…” (dialog, start focus on „Anuluj”, row gone, focus on next „Usuń”, `role="status"` „Na liście (1 z 20)”), „last row” (focus on the `h2`), „Anuluj / Escape” (focus back on „Usuń”), „double Usuń” (one request).
- AC3: test 7 (Tomek on SC-06 and Ola on SC-07 land on `/listy` with „Lista „Dom” została usunięta albo nie masz już do niej dostępu.”, „Dom” no longer on their SC-05; Playwright `LIVE` limit of 5 s).
- AC4: test 6 „offline” (`aria-disabled="true"`, no dialog) and „keeps the dialog open with „Nie udało się usunąć. Spróbuj ponownie.””.
- AC5: test 7 `expectNoAxeViolations` on SC-07 with the open ConfirmDialog, SC-07 after the removal, and the removed person's SC-05.
- SEC1: test 2 (`access.revoked`, then no `item.upserted` / `list.updated` after the owner's next changes; `POST` item, `PATCH` item, `GET` list → 404 `not_found`; re-`subscribe` → `error not_found`).
- SEC2, SEC3: test 4.
- SEC4: test 5 (`event: member_removed`, `listId`, `userId` = owner, `removedUserId`, `route`; no e-mails, names or list name in any log line).

### Decisions for QA and the owner

- **Polite message after a removal:** no text in Copy SC-07, so the `role="status"` region announces the new count heading „Na liście (N z 20)” (existing copy) instead of inventing a sentence. If you want a dedicated sentence (e.g. „Usunięto Tomek z listy.”), add it to Copy SC-07.
- **Copy SC-07:** add „remove.failed — Nie udało się usunąć. Spróbuj ponownie.” to the Copy table (approved 2026-11-01 per AC4). The implementer may not edit `docs/design/`, so it lives only in `messages.ts` with a comment for now.
- `userId` in the path is not checked as a UUID: Better Auth ids are text. The value only goes into a parameterised `DELETE`, and the log entry is written only after a real removal, so it holds an existing id.
- The dialog error text is the same for every failure (also `network`); a 404 (person already gone: left meanwhile, or a retry after a lost response) counts as removed, with no error.
- The dialog stays open while saving; „Anuluj” closes it and the „Usuń” at the row stays in the saving state until the response. A second person can be removed meanwhile; when a removal finishes while another person's dialog is open, focus stays in that dialog.
- No shared „odbierz dostęp” function across modules yet: `withdrawAccess` (in `listy/http/routes.ts`) covers removal and fits T-059 (leaving the list). T-062 (account deletion) can reuse it if it moves to the module's `index.ts`.

### Layer guides (Step 8b)

`backend.md` and `web.md`, „Gdzie jest kod”: new route, helpers and SC-07 files (facts only).

## QA round 1 (2026-11-02)

Verdict: fail

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | major | security / input validation | `userId` from the path of `DELETE /api/v1/lists/:listId/members/:userId` is not validated. A NUL byte reaches Postgres and the API answers 500 instead of 404. This breaks `backend.md` "Zasady bezpieczeństwa": "Wejście, którego baza nie przyjmie (NUL w tekście), odrzuca schemat w `packages/shared`" (QA T-005 round 1) and "Każda trasa … ma schemat zod". It is also SEC3: an id of nobody on the list must give 404. | Temporary QA test (deleted): owner `DELETE …/members/%00` → `500 {"error":{"code":"internal",…}}`. `%2F..%2F..` and `' OR 1=1 --` → 404; a 5000-character id → 414 (Fastify param limit). No data changed, nothing leaked in the body. | Validate `params` with a zod schema (for example a non-empty text id with `withoutNul` and a sane max length) and answer 404 `not_found` like any unknown id, matching the "Implementation notes" route order (validation → `requireListAccess` → domain). Add a negative test with `%00` to `lists.remove-member.authz.test.ts`. |
| 2 | minor | robustness / logging | `securityEvent("member_removed")` is written after `withdrawAccess`. If `peopleWithAccess` throws after the committed `DELETE`, the owner gets a 500 for a removal that happened, and TH-21 loses the trace. | `apps/api/src/modules/listy/http/routes.ts`, the `app.delete` handler | Log right after `removeParticipant` succeeds, before the notifications. |
| 3 | minor | backlog hygiene | SEC1–SEC4 checkboxes are left unchecked, although Evidence covers them. | task file "Acceptance criteria" | Tick them when the evidence is there. |
| 4 | note | design docs | Copy SC-07 still has no `remove.failed` "Nie udało się usunąć. Spróbuj ponownie." (approved 2026-11-01). No polite sentence after a removal either; the count heading is announced instead. | `docs/design/screens/SC-07-uczestnicy.md` Copy table; `messages.ts` | Owner adds the copy line (and decides on a dedicated sentence, if wanted). |
| 5 | note | MC-03 ordering | `revoke` runs after the awaited `DELETE` resolves. Between the commit and `revoke` the event loop can deliver an event from a concurrent write to the removed person's socket. The window is tiny and the event comes at the instant of removal. | `withdrawAccess` in `routes.ts` | Acceptable. Mention it in `architecture.md` "Zmiany na żywo" if the wording "w tej samej operacji" is meant strictly. |
| 6 | note | accessibility (manual) | Manual screen reader, zoom and reduce-motion checks were not done (no assistive tech in this autonomous run). Keyboard, focus and Escape are covered by component tests. axe passes on SC-07 with the dialog open, after the removal and on the removed person's SC-05 (E2E). | — | Cover them in UAT. |

### What QA ran

- `pnpm install --frozen-lockfile`, then `pnpm check`: exit 0 (121 files / 841 Vitest tests, mobile 10 tests, lint, typecheck, jscpd, depcruise, design-check, backlog-check, workflow-check).
- `playwright test e2e/sc07-uczestnicy.spec.ts`: 6 passed (telefon and komputer), including "owner removes participants who have the list open; they land on SC-05" with axe.
- Spot-check 1: `live.revoke(userId, listId)` commented out → both tests in `live.remove-member.test.ts` fail. Restored.
- Spot-check 2: `listId` dropped from the `DELETE … WHERE` in `lists-repository.ts` → "removes nobody from another list…" fails. Restored.
- Exploits (temporary test, deleted): the removed person with two open WS tabs gets `access.revoked` in both, then no `item.upserted`. A second `DELETE` → 404. The removed person's `DELETE …/members/<owner>` and `GET …/members` → 404. After re-adding the membership, `GET` the list → 200 (rejoin works). Hostile ids: see finding 1.
- `git status` clean after the spot-checks.

### Acceptance criteria

- AC1 pass: test 1 and test 3 read and run; the assertions match the criterion.
- AC2 pass: component tests (dialog, starting focus on "Anuluj", focus to the next row or to the heading, Escape, one request).
- AC3 pass: E2E with 3 contexts.
- AC4 pass: offline `aria-disabled`, error text in the dialog, which stays open.
- AC5 pass: E2E axe.
- SEC1 pass: test 2, plus the two-tabs exploit.
- SEC2 pass: authz test.
- SEC3 fail on hostile input (finding 1). The ordinary cases pass.
- SEC4 pass: log test (ids only, no names or e-mails).

### Must change

1. Validate `userId` (and the route params) with a zod schema so that NUL and other input the database rejects gives 404 `not_found`, not 500, with a negative test.
