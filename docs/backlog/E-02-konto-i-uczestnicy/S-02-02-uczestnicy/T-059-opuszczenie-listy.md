---
id: T-059
title: Opuszczenie listy przez uczestnika
epic: E-02
story: S-02-02
status: done           # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given uczestnik, when `POST /api/v1/lists/:listId/leave`, then 204, członkostwo usunięte, `revoke` dla wszystkich jego połączeń, `members.changed` do listy, `lists.changed` do niego i właściciela; jego pozycje zostają z imieniem. — verified by: test integracyjny
- [x] AC2: Given właściciel, when `POST …/leave`, then 403 `owner_cannot_leave`, nic się nie zmienia; SC-07 właściciela nie ma „Opuść listę”. — verified by: test integracyjny + test komponentu
- [x] AC3: Given SC-07 uczestnika, when „Opuść listę” → ConfirmDialog z nazwą listy → „Opuść”, then przejście na SC-05 (`replace`, wstecz nie wraca na listę) bez tej listy; „Anuluj” wraca z fokusem na „Opuść listę”; błąd serwera — komunikat w oknie, okno zostaje; offline — przycisk nieaktywny. — verified by: test komponentu (MSW)
- [x] AC4: Given druga karta uczestnika z otwartym SC-06 tej listy, when wychodzi z listy w pierwszej, then druga karta w ≤ 5 s jest na SC-05 z komunikatem o braku dostępu. — verified by: E2E Playwright (dwie karty)
- [x] AC5: Given ConfirmDialog i SC-05 po wyjściu, when E2E je odwiedza, then axe bez naruszeń. — verified by: E2E + axe
- [x] SEC1 (TH-04): Given uczestnik po wyjściu, when następne zdarzenie listy, then do żadnego jego połączenia nie dociera; zapis i odczyt listy → 404. — verified by: test integracyjny WS + HTTP
- [x] SEC2 (TH-01): Given domownik bez dostępu do listy A, when `POST /api/v1/lists/<A>/leave`, then 404; anonim 401. — verified by: test integracyjny autoryzacji

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

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

### Tests (red → green)

| # | Test | Red (before the code) | Now |
| --- | --- | --- | --- |
| 1 | `apps/api/test/lists.leave.test.ts` › „answers 204, removes the membership and keeps the items the participant added and checked” | `expected 501 to be 204` (stub route) | pass |
| 2 | `apps/api/test/live.leave.test.ts` › „sends access.revoked to every tab of the participant, then no list event, and refuses writes and reads” (two WS connections of Tomek; afterwards `POST`/`PATCH` item, `GET` list, `GET …/members` and a second `POST …/leave` → 404 `not_found`; re-`subscribe` → `error not_found`) and › „tells the list members.changed and refreshes SC-05 of the participant who left and of everyone left” | Written after `withdrawAccess` was wired in the green step of #1 (the route reuses T-058's function). Bite check: the `withdrawAccess` call removed → both fail (`no "access.revoked" within 1000 ms; got [subscribed]`, `no "members.changed" within 1000 ms`); restored | pass |
| 3 | `apps/api/test/lists.leave.authz.test.ts` (3 tests: owner 403 `owner_cannot_leave`, membership and his `GET /lists` unchanged; stranger, missing, malformed and `%00` `listId` 404 identical, anonymous 401; foreign `Origin` 403 `invalid_origin`, participant kept) | owner test: `expected 404 to be 403`. The 404/401 and `Origin` tests passed at once (`requireListAccess`, `requireUser` and `trustedOrigin` already guard every `/api/v1/*` route) | pass |
| 4 | `apps/web/src/screens/SC-07-uczestnicy/ParticipantsScreen.leave.test.tsx` (10 tests: dialog + `replace` to SC-05 without the list; „Anuluj” / Escape focus back on „Opuść listę”; server error in the dialog, retry; offline `aria-disabled`, no dialog; owner has no „Opuść listę”; double „Opuść” = one request; lost response, retry 404 → SC-05 without error; `access.revoked` before the response → one navigation, no „no access” notice; SC-05 without the list before the lists are fetched again; browser Back does not show the list) | first test: `Unable to find an accessible element with the role "button" and name "Opuść listę"`. The other tests were written after the hook and passed at once; each was checked against a mutant (code changed, test run, code restored): `leaveListKey` not skipped in `useLiveList` → „access.revoked before the response” fails; 404 treated as an error → „lost response” and „access.revoked” fail; no `writes` → „offline” fails; no `error` in the dialog → „keeps the dialog open” and „lost response” fail; no `returnFocus` → „Anuluj / Escape” fails; `navigate` without `replace` → 6 tests fail; `useMutation` instead of `useGuardedMutation` → „double Opuść” fails; button also for the owner → „owner” fails; no drop of the list from the `GET /lists` cache → „SC-05 without the list at once” (and 2 more) fail | pass |
| 5 | `apps/web/e2e/sc07-uczestnicy.spec.ts` › „SC-07 participant leaves the list; the other tab lands on SC-05 and the owner sees it” (Ania on SC-07, Tomek's tab 1 on SC-07, tab 2 on SC-06; axe on the open ConfirmDialog, on Tomek's SC-05 after leaving (empty state) and on tab 2's SC-05 with the notice; Ania sees „Na liście (0 z 20)” within 5 s) | written after the behaviour (slow E2E, run last). Bite check: `withdrawAccess` removed from the route (API rebuilt) → fails (`expect(locator).toBeVisible() failed`: tab 2 gets no SC-05 notice); restored | pass (telefon + komputer) |

### Commands (this run, 2026-11-02)

- `pnpm check` (format, lint, typecheck, jscpd 0 clones, depcruise no violations, design-check, backlog-check, workflow-check, `vitest run` 125 files / 858 tests, mobile tests): exit 0
- `pnpm vitest run --project api --sequence.shuffle.files --sequence.seed=59` and `=159`: 84 files / 343 tests passed. (`--sequence.shuffle` also shuffles tests inside a file and then fails `database.test.ts` › „starts the next test with empty tables”, a pre-existing test that depends on the order of its own two tests on purpose; unrelated to this task.)
- `playwright test e2e/sc07-uczestnicy.spec.ts`: 8 passed (telefon + komputer).
- `pnpm test:e2e`: 68 passed (7.2 min, Windows, 1 worker).
- A flaky failure seen once: `apps/web/src/live/connection.test.tsx` › „SC-07: after a silent drop (no browser event) fetches the participants again” failed in one run of `vitest run --project web` (SC-07, `live`, SC-06 folders) and passed in the next 3 runs and in `pnpm check`. The junit file was overwritten before it was saved (layers/web.md asks to keep it), so the message is lost. The file is not touched by this task; the only change in `useLiveList` is the skip condition (`isExitingOnItsOwn`), which does nothing in that test (no leave or delete mutation runs). QA: watch for it.

### Acceptance criteria

- AC1: test 1 (204, membership gone, Tomek's added and checked items keep `addedBy` / `checkedBy` Tomek, his `GET /lists` is empty) + test 2 (`access.revoked` to both of his connections, `members.changed` to the list, `lists.changed` to him (both tabs), to the owner (also a second connection) and to the remaining participant). Route: `requireListAccess(…, "member")` → `leaveList` → `withdrawAccess` (the same function as T-058).
- AC2: test 3 „owner_cannot_leave” (403, nothing changes) + test 4 „SC-07 of the owner has no „Opuść listę””.
- AC3: test 4 (dialog „Opuścić listę „Dom”?” with description „Żeby wrócić, potrzebujesz nowego zaproszenia.”, start focus on „Anuluj”, `replace` to `/listy` without the list, Back does not show the list, „Anuluj” / Escape focus back on „Opuść listę”, error in the dialog which stays open, offline inactive).
- AC4: test 5 (tab 2 on SC-06 lands on `/listy` with „Lista „Dom” została usunięta albo nie masz już do niej dostępu.” within the 5 s `LIVE` limit).
- AC5: test 5 `expectNoAxeViolations` on the ConfirmDialog, on SC-05 after leaving and on the second tab's SC-05.
- SEC1: test 2 (no `item.upserted` / `list.updated` to either tab after the owner's next changes; writes and reads 404).
- SEC2: test 3 (stranger 404 exactly like a missing list, anonymous 401).

### Decisions for QA and the owner

- **Error text in the dialog:** Copy SC-07 has no text for a failed leave. Used „Nie udało się opuścić listy. Spróbuj ponownie.”, following the other SC-07 write errors that are also outside the Copy table („Nie udało się unieważnić linku. Spróbuj ponownie.”). `network` gives the shared „Brak połączenia. Sprawdź internet i spróbuj ponownie.” (`errorText`). Owner: add `leave.failed` to Copy SC-07 or give another text.
- **No notice on SC-05 after a voluntary leave:** the person chose to leave, so their SC-05 shows no „no access” notice (Demo step 2 shows none either). Their other tabs get the existing MC-03 notice (AC4).
- **Own `access.revoked`:** the server sends `access.revoked` to every connection of the person who leaves, usually before the HTTP response. `useLiveList` skips it while this tab's leave is in progress (`leaveListKey`, like `deleteListKey` for deleting a list; both now in `lists/ownExit.ts`, `isExitingOnItsOwn`), so the tab goes to SC-05 once, from the response. The same covers „owner removes the participant at the same moment”: the leave then gets 404, which counts as left.
- **„Wstecz nie wraca na listę”:** `replace` swaps SC-07 for SC-05 (as `useLiveList` does after a lost access). Browser Back then lands on the SC-06 entry, which shows the MC-01 „no access” screen (API 404), never the list itself (test 4 „Back”).
- **No `security` log event for leaving:** `architecture.md` „Obserwowalność” lists the removal of a participant, not leaving; TH-21 is not in `threats:`. Not added.
- **E2E second tab:** a second browser context with Tomek's session cookies, not `context.newPage()` (that stalls the API on Windows, layers/web.md „Pułapki”). For the server it is the same session with a second WS connection.

### Layer guides (Step 8b)

`backend.md` and `web.md`, „Gdzie jest kod”: leave route, `leaveList`, SC-07 `LeaveList` / `useLeaveList`, `lists/ownExit.ts` (renamed from `lists/deleteListKey.ts`) (facts only).

## QA round 1 (2026-11-02)

Verdict: pass

Independent run on `epic/E-02-konto-i-uczestnicy` @ `a6191b8` (Windows, Docker Postgres).

**Reproduce.** `pnpm install --frozen-lockfile` (no tracked files changed), `pnpm check`: format, lint, typecheck, jscpd, depcruise, design-check, backlog-check, workflow-check all green; `vitest run` 857/858 — the one failure is `apps/web/src/live/connection.test.tsx` › „SC-07: after a silent drop (no browser event) fetches the participants again” (`expected [ { type: 'subscribe' } ] to have a length of 2 but got 1`), see finding 1. `pnpm test:mobile` 10/10. The task's own tests (4 files, 16 tests) pass. `playwright test e2e/sc07-uczestnicy.spec.ts` twice (telefon + komputer): the T-059 test passed both times (8/8 on the second run; on the first run the T-057 test „SC-07 empty and load error states pass axe” failed once on `komputer`, then passed 2 + 8 times, finding 2).

**Acceptance criteria.**

| AC | Result | How verified |
| --- | --- | --- |
| AC1 | pass | `lists.leave.test.ts`, `live.leave.test.ts` read and run; live server: 204, Tomek's WS gets `subscribed, access.revoked, lists.changed`; Ania's members list empty; „Mleko” keeps `addedBy` Tomek |
| AC2 | pass | `lists.leave.authz.test.ts`; live server: owner → 403 `owner_cannot_leave`; component test „SC-07 of the owner has no „Opuść listę”” |
| AC3 | pass | `ParticipantsScreen.leave.test.tsx` (10 tests) read and run: dialog text and description, start focus „Anuluj”, `REPLACE` to `/listy`, focus back on „Opuść listę”, error stays in dialog, offline `aria-disabled` |
| AC4 | pass | E2E two contexts: second tab lands on SC-05 with the MC-03 notice; owner sees „Na liście (0 z 20)” within `LIVE` |
| AC5 | pass | E2E `expectNoAxeViolations` on the open ConfirmDialog, SC-05 after leaving and second tab's SC-05 |
| SEC1 (TH-04) | pass | live server: after leave no `item.upserted` / `list.updated` reaches Tomek's socket after the owner's changes; re-`subscribe` → `error`; `GET` list / members, `POST` item → 404 |
| SEC2 (TH-01) | pass | live server: stranger → 404 `not_found` (same for missing UUID and `' OR 1=1--` id), anonymous → 401 |

**Spot-checks (mutants, all reverted, `git status` clean).** Owner guard removed from `leaveList` → authz test fails (`expected 404 to be 403`). `withdrawAccess` removed from the leave route → both `live.leave.test.ts` tests fail. `replace: false` in `useLeaveList` → 2 component tests fail („replaces SC-07 with SC-05”, „Wstecz”).

**Exploratory (local E2E server, three accounts via sign-up API).** Foreign `Origin` → 403 `invalid_origin`; a JSON body `{ userId }` is ignored (only the caller leaves); double leave in parallel ×5 → 204/404, one withdrawal; leave racing the owner's `DELETE` list ×5 → both 204, no error; leave racing the owner's removal of the participant ×5 → 204/404, participant gone, which the client treats as left (component test „lost response”); re-joining with a new link works (200, list readable again). No `security` log event for leaving: consistent with `architecture.md` „Obserwowalność” (removal only).

**Code review.** Small, follows T-058: route → `requireListAccess(…, "member")` → `leaveList` → shared `withdrawAccess`; client `useGuardedMutation` with `leaveListKey`, `isExitingOnItsOwn` merges the two own-exit keys (rename of `deleteListKey.ts` is in scope). Tests assert behaviour at the agreed seams (HTTP, WS, MSW screen, browser); expected values are literals. Red evidence present for #1, #3, #4; #2 and #5 were written after green and justified by recorded bite checks, which I reproduced for #2.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | tests (outside task) | Flaky `connection.test.tsx` › „SC-07: after a silent drop …” (from T-063, not touched by T-059). Root cause: `LiveSocket.reconnect()` waits `1000 * 2 ** retries` ms (first retry 1000 ms), while `subscribed(live, 2)` uses `waitFor` with the default 1000 ms timeout after `findByText(OFFLINE)` already spent part of it — the window is at the edge. | Failed in this QA's `pnpm check`; 1/12 isolated runs at HEAD; author saw it once too | Fix task: give that `waitFor` an explicit timeout above the first retry delay (or fake timers) |
| 2 | minor | tests (outside task) | E2E `sc07-uczestnicy.spec.ts:64` „SC-07 empty and load error states pass axe” failed once on `komputer`, then passed 10 times; message overwritten by the rerun. | First Playwright run in this QA | Watch; capture trace on next failure |
| 3 | minor | copy | „Nie udało się opuścić listy. Spróbuj ponownie.” is outside the Copy SC-07 table (author's decision, same pattern as the T-058 text the owner approved). | `SC-07-uczestnicy/messages.ts` | Owner adds `leave.failed` to Copy SC-07 or gives another text |
| 4 | minor | naming / docs | `removeParticipant` doc comment says „tylko właściciel”, but `leaveList` now calls it for the participant himself. | `apps/api/src/modules/listy/domain/lists.ts` | Update the comment |
| 5 | note | accessibility | Manual checks (screen reader, 200 % zoom, reduce motion) not performed in this autonomous run; keyboard flow and focus return are covered by component tests, axe by E2E. | — | Cover in UAT |
