---
id: T-062
title: Usunięcie konta (SC-09)
epic: E-02
story: S-02-03
status: in-qa          # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-056, T-063]
size: M                # S | M (L must be split)
layers: [backend, web]
requirements: [F-04, N-02, N-04]
threats: [TH-17, TH-18, TH-21, TH-28]
screens: [SC-09, SC-01, SC-06, SC-05]
---

# T-062 Usunięcie konta (SC-09)

## Goal

Domownik trwale usuwa konto z SC-09 po potwierdzeniu. Jego listy znikają także u uczestników, z cudzych list zostaje wypisany (pozycje zostają z podpisem „usunięty użytkownik”), wszystkie jego sesje i połączenia na żywo kończą się, a logowanie na to konto się nie udaje.

## Demo

1. Ania (właściciel „Dom” z uczestnikiem Tomkiem; uczestniczka „Działka” Oli, gdzie dodała „Węgiel”): SC-09 → „Usuń konto” → „Usunąć konto na zawsze? 1 Twoich list zniknie, także u ich uczestników. Tego nie da się cofnąć.” → „Usuń konto”.
2. Ania na SC-01 z „Konto zostało usunięte.”. Logowanie jej danymi → „Nieprawidłowy e-mail lub hasło.”.
3. Tomek z otwartą „Dom” → SC-05 z komunikatem o usunięciu listy. Ola na „Działka”: „Węgiel — dodał(a) usunięty użytkownik”; Ani nie ma na SC-07.
4. Druga przeglądarka Ani (inna sesja) przy następnej akcji trafia na SC-01.

## Context

- BRD: F-04 — „listy właściciela usuwane, uczestnicy tracą dostęp; z cudzych list wypisany, pozycje zostają z podpisem „usunięty użytkownik”; logowanie na usunięte konto się nie udaje; wymaga wyraźnego potwierdzenia”; N-02.
- Architektura: `api.md` „Konto” (`DELETE /api/v1/me { confirm: true }` → 204; `list.deleted` / `access.revoked` / `lists.changed` do dotkniętych osób; sesje zamknięte; 400 bez `confirm`), `data-model.md` (kaskady i `SET NULL`, inwentarz danych osobowych), TH-17, TH-18, TH-28, log `security` („usunięcie konta”).
- Design: SC-09 — sekcja „Usuń konto” (`h2`, opis skutków, przycisk niebezpieczny), ConfirmDialog z liczbą list `{n}` (fokus startowy na „Anuluj”), stany Loading (w oknie), Error — zapis, Offline („Usuń konto” nieaktywny), Success — usunięcie (SC-01 z „Konto zostało usunięte.”).
- Depends on: T-056 — `revoke` bez wyścigu z `subscribe`; T-063 — stan offline. Z T-054 może już istnieć zamykanie wszystkich połączeń użytkownika — użyj go, jeśli jest.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given domownik D: właściciel list L1, L2 (z uczestnikami), uczestnik listy M (dodał i odhaczył tam pozycje), when `DELETE /api/v1/me { confirm: true }`, then 204 i w jednej transakcji: L1, L2 z pozycjami, członkostwami i zaproszeniami usunięte; członkostwo w M usunięte; pozycje D w M mają `addedBy: null` / `checkedBy: null`; `user`, `session`, `account`, aktywność dzienna D usunięte. — verified by: test integracyjny (stan bazy przed i po)
- [x] AC2: Given brak `confirm: true`, then 400 i nic się nie zmienia. — verified by: test integracyjny
- [x] AC3: Given uczestnicy L1 z otwartą listą i uczestnicy M, when D usuwa konto, then uczestnicy L1 dostają `list.deleted` i `lists.changed` (SC-06 → SC-05 z komunikatem o usunięciu), uczestnicy M — `members.changed` i odświeżone pozycje z „usunięty użytkownik”. — verified by: test integracyjny WS + E2E dwa konteksty
- [x] AC4: Given SC-09, when „Usuń konto”, then ConfirmDialog z liczbą własnych list i fokusem na „Anuluj”; „Usuń konto” w oknie → Loading → SC-01 (`replace`) z „Konto zostało usunięte.” (`role="status"`), sesja klienta wyczyszczona; błąd serwera — „Nie udało się zapisać. Spróbuj ponownie.” w oknie; offline — „Usuń konto” nieaktywny. — verified by: test komponentu (MSW)
- [x] AC5: Given SC-09 z otwartym ConfirmDialog i SC-01 po usunięciu, when E2E je odwiedza, then axe bez naruszeń. — verified by: E2E + axe
- [x] SEC1 (TH-17): Given D z dwiema sesjami, when usuwa konto, then żądanie z każdą z nich daje 401, a logowanie e-mailem i hasłem D — 401 `invalid_credentials` (ten sam co dla nieistniejącego konta). — verified by: test integracyjny
- [x] SEC2 (TH-28): Given otwarte połączenia WS obu sesji D, when usuwa konto, then wszystkie gniazda D są zamknięte (1008), a nowe połączenie z jego ciasteczkiem odrzucone. — verified by: test integracyjny WS
- [x] SEC3 (TH-18): Given inni domownicy z własnymi listami i pozycjami, when D usuwa konto, then ich listy, pozycje (także te odhaczone przez D) i członkostwa poza listami D są nienaruszone. — verified by: test integracyjny F-04
- [x] SEC4 (TH-21): Given usunięcie konta, then log `security` ma zdarzenie `account_deleted` z `userId`, bez e-maila i imienia; anonim `DELETE /api/v1/me` → 401, obcy `Origin` → 403. — verified by: test logów + test integracyjny

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API `DELETE /api/v1/me`, logowanie, WebSocket `/api/v1/live`
- ekran SC-09 z MSW
- przeglądarka (Playwright, dwa konteksty)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | usunięcie konta wg F-04: listy, członkostwa, `SET NULL`, sesje, aktywność | integration | Vitest + Testcontainers | AC1 |
| 2 | dane innych nienaruszone | integration | Vitest + Testcontainers | SEC3 |
| 3 | bez `confirm` 400; anonim 401; obcy `Origin` 403 | integration | Vitest + Testcontainers | AC2, SEC4 |
| 4 | sesje 401, logowanie 401 `invalid_credentials` | integration | Vitest + Testcontainers | SEC1 |
| 5 | gniazda D zamknięte; zdarzenia do uczestników L1 i M | integration | Vitest + Testcontainers + `ws` | SEC2, AC3 |
| 6 | log `security` `account_deleted` | integration | Vitest | SEC4 |
| 7 | SC-09: dialog z liczbą list, fokus, Loading, błąd, offline, przejście na SC-01 | component | Vitest + RTL + MSW | AC4 |
| 8 | E2E: usunięcie konta właściciela przy otwartej liście uczestnika; axe | E2E | Playwright + axe | AC3, AC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** API tylko w testach komponentów; baza prawdziwa.

**Client state during writes:** usunięcie — odpowiedź opóźniona (podwójne potwierdzenie = jedno żądanie; okna nie da się zamknąć w trakcie), utracona po zapisie (ponowienie dostaje 401 → klient i tak przechodzi na SC-01, bez fałszywego „Nie udało się”), liczba list zmienia się w trakcie otwartego okna (liczba z chwili otwarcia; po `lists.changed` aktualizowana).

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** konto bez list; konto z 50 listami po 500 pozycji (czas usunięcia, brak timeoutu); usunięcie w trakcie, gdy uczestnik dodaje pozycję na liście D; ponowna rejestracja tym samym e-mailem po usunięciu (powinna działać); aktywne linki zaproszeń D przestają działać.
- **Design states:** SC-09: dialog, Loading, błąd, offline; SC-01 z komunikatem; SC-05 / SC-06 uczestników.
- **Platforms / devices:** telefon (Safari, Chrome), komputer.
- **Accessibility:** dialog (fokus na „Anuluj”, Escape), komunikat po usunięciu ogłaszany na SC-01.
- **Security / privacy:** po usunięciu w bazie nie ma e-maila ani imienia D (sprawdzić inwentarz z `data-model.md`, także `sign_in_failure` i `verification`); stara sesja D na drugim urządzeniu; logi bez danych osobowych.
- **Regression:** J-01 (rejestracja tym samym e-mailem), F-10 „usunięty użytkownik” (T-007), J-05.

## Implementation notes

- Better Auth ma własną ścieżkę usuwania użytkownika; tu własna trasa `DELETE /api/v1/me` z transakcją wg `data-model.md` (kaskady w schemacie), a potem zdarzenia i zamknięcie połączeń po commit. Identyfikatory list i uczestników do powiadomienia zebrać przed usunięciem.
- Liczba list do okna: z `GET /api/v1/lists` (`role: "owner"`).
- `verification` (tokeny resetu) i `sign_in_failure` kluczowane e-mailem / pseudonimem — usunąć wiersze D w tej samej transakcji albo opisać, czemu zostają do wygaśnięcia (sprzątanie T-064).

## Definition of done

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Run 2026-11-02 (implementer). Commands: `pnpm check` (format, lint, typecheck, jscpd 0 clones, depcruise 0 violations, design-check, backlog-check, workflow-check, all Vitest projects 137 files / 912 tests, mobile) — pass; `pnpm vitest run --project api --sequence.shuffle --sequence.seed=11` and `=42` — 94 files / 375 tests pass; `pnpm test:e2e` (full suite, `E2E_MAILPIT_PORT=3135`, because a stale Mailpit container from an earlier run held port 3125) — 74 passed.

### TDD plan

| # | Test (file) | Red | Now |
| --- | --- | --- | --- |
| 1 | `apps/api/test/me.delete.test.ts` „answers 204 and removes the account, its lists, memberships, sessions and activity, keeping its items on others' lists unsigned” | `expected 501 to be 204` (stub route) | pass |
| 2 | `apps/api/test/me.delete.others.test.ts` „keeps others' lists, items (also those the account checked) and memberships outside its lists” | passed on first run (cascades + route from #1). Bite check: extra `DELETE FROM item WHERE checked_by = $1` in `deleteAccount` → `expected [] to match object [ { …(5) } ]`; reverted | pass |
| 3 | `apps/api/test/me.delete.authz.test.ts` — 400 for no body / `{}` / `confirm: false` / `confirm: "true"`; anonymous 401; foreign and missing `Origin` 403 | 400 cases: `expected 204 to be 400`; the no-body case then failed on missing `fields.confirm` (fixed: body `?? {}`). 401 / 403 passed on first run (shared `requireUser`, `trustedOrigin`) | pass |
| 4 | `apps/api/test/me.delete.sessions.test.ts` — both sessions 401, sign-in 401 `invalid_credentials` identical to an unknown account; the same e-mail can sign up again | passed on first run (session cascade from #1). Bite check: `tx.delete(user)` removed → `expected 200 to be 401`; reverted | pass |
| 5 | `apps/api/test/live.delete-account.test.ts` — sockets of both sessions closed 1008 + upgrade 401; `list.deleted` + `lists.changed` to participants of an own list, re-subscribe `not_found`; `members.changed` + `lists.changed` on someone else's list | events: `no "list.deleted" within 1000 ms`, `no "members.changed" within 1000 ms`. The 1008 test passed first (`closeUser` was written together with the route in #1, out of order); bite check: `closeUser` call removed → `connection still open`; reverted | pass |
| 6 | `apps/api/test/me.delete.logs.test.ts` — `account_deleted` with `userId` and `route`, no e-mail / name / list name in any log line; nothing logged on refusal | `expected [] to deeply equal [ ObjectContaining{…} ]` | pass |
| 7 | `apps/web/src/screens/SC-09-konto/AccountScreen.delete.test.tsx` (10 tests: section; dialog with count and focus on „Anuluj”; one request, dialog not closable while saving, SC-01 by `replace` with `role="status"`, client session cleared; server error in the dialog; lost response → retry 401 → SC-01 with the message; first-attempt 401 → SC-01 without it; offline trigger; offline in the open dialog; count updated after `lists.changed`; fallback text when the lists did not load) | first two: `Unable to find role="button" and name "Usuń konto"`; „deletes once…”: `Unable to find role="status"` (twice — the second time because the screen's own `navigate` lost the race with the `RequireSession` redirect, see Decisions). The other 7 passed on first run (behaviour built with the earlier ones); bite checks, each reverted: retry-401 rule removed → retry test fails; dialog closable while saving → „deletes once…” fails; `writes` removed from the trigger → offline test fails; guard without the `accountDeleted` reason → „deletes once…” and the retry test fail | pass |
| 8 | `apps/web/e2e/j01-usuniecie-konta.spec.ts` „F-04 deleting the account removes its lists live and keeps its items on others' lists” (two contexts; axe on SC-09, the open dialog and SC-01 after deletion) | written after the behaviour worked at the faster seams (testing-strategy order); not seen red | pass (7.2 s) |

### Acceptance criteria

- AC1: test #1 — row counts before/after for `user`, `session` (2), `account`, owned `shopping_list`, `list_member`, `list_daily_activity`, `verification` reset token; both own lists with items, members and invitations gone; the item on Ola's list keeps `addedBy: null`, `checkedBy: null`, `checked: true`.
- AC2: test #3 (4 bodies → 400 `validation_failed` with `fields.confirm = "required"`; account and list unchanged).
- AC3: test #5 (WS) + test #8 (Tomek with „Dom” open lands on SC-05 with „Lista „Dom” została usunięta albo nie masz już do niej dostępu.”; „Działka” shows „dodał(a) usunięty użytkownik”).
- AC4: test #7.
- AC5: test #8 — `expectNoAxeViolations` on SC-09, SC-09 with the open ConfirmDialog, SC-01 after deletion.
- SEC1: test #4. SEC2: test #5 (first test). SEC3: test #2. SEC4: tests #6 and #3.

### Decisions for QA

- Deletion is one transaction in `apps/api/src/modules/konta/infra/users.ts` (`deleteAccount`): `SELECT … FOR UPDATE` on the user row, then the `listy` hook (`listsWithPeopleOf`: own lists `FOR UPDATE`, so a concurrent join waits), then `DELETE verification` (reset tokens, value = user id) and `DELETE user` (cascades / `SET NULL` from the schema). Events and `closeUser` only after commit. Order of `live` calls: `list.deleted` → `revoke` of everyone on own lists; `revoke` of the account + `members.changed` on others' lists; one `lists.changed` to all affected people; then `closeUser` (1008).
- `sign_in_failure` and the `rate_limit` row `password-reset-email:<pseudonym>` stay until they expire (data-model.md: pseudonymous, short windows): deleting an account must not reset abuse counters for that e-mail (delete + re-register would otherwise reset the reset-mail limit). They hold no e-mail or name.
- The 204 does not clear the session cookie (it points to a deleted session; every use answers 401). The client ends its own session.
- Web: the screen does not navigate after success. `useEndSession("accountDeleted")` stores the reason next to the session query and `RequireSession` redirects to SC-01 with `{ accountDeleted: true }` (no `from`). A screen-level `navigate` raced with the guard's `<Navigate>` and lost the message (seen red in test #7).
- 401 counts as success only on a retry within the same screen (lost response); a 401 on the first attempt is an ordinary session end (no „Konto zostało usunięte.”), handled by `RequireSession`.
- Dialog count: own lists from `useLists()` (SC-05 query; `lists.changed` invalidates it, so the open dialog updates). While the lists are not loaded or failed to load, the dialog uses the section's `delete.body` text from Copy instead of a number.
- „{n} Twoich list zniknie” is used literally from Copy (no Polish plural forms), as in the Demo.
- `AccountScreen.test.tsx` and `AccountScreen.name.test.tsx` now stub `GET /api/v1/lists` (`listsAre([])`), because SC-09 fetches the lists.

### Layer guides (Step 8b)

`docs/architecture/layers/backend.md` and `web.md` — „Gdzie jest kod” and the change history updated with the new files (facts only).
