---
id: T-061
title: Zmiana imienia (SC-09)
epic: E-02
story: S-02-03
status: in-qa                 # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-060, T-063]
size: M                # S | M (L must be split)
layers: [backend, web]
requirements: [F-16, N-04]
threats: [TH-29]
screens: [SC-09, SC-06, SC-07, SC-05]
---

# T-061 Zmiana imienia (SC-09)

## Goal

Domownik zmienia imię na SC-09. Nowe imię widać od razu przy jego pozycjach („dodał(a)”, „kupił(a)”), na listach uczestników i na kartach SC-05 u wszystkich osób z dostępem, w ≤ 5 s u tych, którzy mają je otwarte.

## Demo

1. Tomek: SC-09 → pole „Imię” z „Tomek” → wpisz „Tomasz” → „Zapisz imię” → Toast „Imię zmienione”.
2. Ania z otwartą „Dom”: przy pozycjach Tomka „dodał(a) Tomasz” w ≤ 5 s; na SC-07 wiersz „Tomasz”.
3. Puste imię → „Wpisz imię”; 31 znaków → „Imię może mieć najwyżej 30 znaków”.

## Context

- BRD: F-16 — „imię 1–30 znaków, widoczne przy pozycjach i na listach uczestników u wszystkich; nie musi być unikalne; puste lub za długie — czytelny komunikat”.
- Architektura: `api.md` „Konto” (`PATCH /api/v1/me { name }` → 200 `{ id, name, email }`; 400), zdarzenia na żywo: `members.changed` do list z dostępem, `lists.changed` do osób z dostępem (SC-05 pokazuje „od <imię>” i awatary); pozycje niosą `addedBy.name` / `checkedBy.name` — klient potrzebuje odświeżenia listy (wybór zdarzenia w tasku: ponowne pobranie przy `members.changed` albo nowe zdarzenie, wtedy aktualizacja `api.md`).
- Design: SC-09 — pole „Imię” (max 30, `autocomplete="given-name"`, opis „Tak zobaczą Cię inni na wspólnych listach.”), „Zapisz imię”, stany Loading, Error — imię, Error — zapis, Offline („Zapisz imię” nieaktywny), Success — imię (Toast).
- Existing code: `apps/web/src/screens/SC-09-konto/` (dziś imię jako tekst w `dl`), `apps/web/src/session/` (`useSession` — nowe imię także w sesji klienta).
- Depends on: T-060 — reguła tekstu widocznego dla innych; T-063 — stan offline.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [x] AC1: Given zalogowany domownik, when `PATCH /api/v1/me { name: " Tomasz " }`, then 200 `{ id, name: "Tomasz", email }`; `GET /api/v1/me`, `GET /api/v1/lists`, `GET …/members` i pozycje zwracają nowe imię. — verified by: test integracyjny
- [x] AC2: Given imię puste, z samych spacji, dłuższe niż 30 znaków albo z niedozwolonymi znakami (T-060), then 400 `validation_failed` z błędem pola; imię bez zmian. — verified by: test integracyjny
- [x] AC3: Given osoby z otwartą listą, na której domownik jest właścicielem lub uczestnikiem, when zmienia imię, then w ≤ 5 s widzą nowe imię przy jego pozycjach (SC-06), w wierszu SC-07 i na karcie SC-05. — verified by: test integracyjny WS (zdarzenia do właściwych osób) + E2E dwa konteksty
- [x] AC4: Given SC-09, when „Zapisz imię”, then Loading w przycisku (fokus zostaje), Toast „Imię zmienione” (`role="status"`), pole z nowym imieniem, `useSession` z nowym imieniem; błąd pola — komunikat pod polem z fokusem na polu; błąd serwera — „Nie udało się zapisać. Spróbuj ponownie.”; offline — „Zapisz imię” nieaktywny. — verified by: test komponentu (MSW)
- [x] AC5: Given SC-09 w stanach: formularz, błąd pola, błąd zapisu, offline, sukces, when E2E je odwiedza, then axe bez naruszeń; `h1` „Konto”, `h2` „Twoje dane”. — verified by: E2E + axe
- [x] SEC1 (TH-29): Given imię „Ania‮…” albo z samym U+200B, when `PATCH /api/v1/me`, then 400 i imię bez zmian. — verified by: test integracyjny
- [x] SEC2: Given anonim, when `PATCH /api/v1/me`, then 401; given obcy `Origin`, then 403 `invalid_origin`; żądanie z polami innymi niż `name` (np. `email`) nie zmienia ich. — verified by: test integracyjny

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API `PATCH /api/v1/me` i WebSocket `/api/v1/live`
- ekran SC-09 z MSW
- przeglądarka (Playwright, dwa konteksty)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | zmiana imienia widoczna w `me`, listach, uczestnikach, pozycjach | integration | Vitest + Testcontainers | AC1 |
| 2 | walidacja: puste, 31 znaków, niedozwolone znaki; dodatkowe pola ignorowane | integration | Vitest + Testcontainers | AC2, SEC1, SEC2 |
| 3 | anonim 401, obcy `Origin` 403 | integration | Vitest + Testcontainers | SEC2 |
| 4 | zdarzenia na żywo do osób z dostępem (i tylko do nich) | integration | Vitest + Testcontainers + `ws` | AC3 |
| 5 | SC-09: zapis, Toast, błędy, offline, sesja klienta | component | Vitest + RTL + MSW | AC4 |
| 6 | E2E: zmiana widoczna u drugiej osoby ≤ 5 s; axe | E2E | Playwright + axe | AC3, AC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** API tylko w testach komponentów; baza prawdziwa.

**Client state during writes:** zmiana imienia — odpowiedź opóźniona (użytkownik zmienia pole dalej: po odpowiedzi pole nie nadpisuje nowszego wpisu, Toast mówi o zapisanym), utracona po zapisie (ponowienie tym samym imieniem = 200 bez skutków ubocznych), zmiana imienia w innej karcie w międzyczasie (pole pokazuje stan z serwera po fokusie / odświeżeniu sesji).

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** imię dokładnie 30 znaków (z polskimi znakami i emoji); takie samo imię jak inny uczestnik; zmiana imienia przez osobę bez list; imię w zaproszeniu SC-08 („{imię} zaprasza Cię…”) po zmianie.
- **Design states:** SC-09: Loading, błąd pola, błąd zapisu, offline, Toast.
- **Platforms / devices:** telefon (Safari, Chrome), komputer, 200 %.
- **Accessibility:** etykieta i opis pola czytane, Toast ogłaszany, fokus po błędzie.
- **Security / privacy:** TH-29 ręcznie; zdarzenia nie trafiają do osób bez wspólnej listy; logi bez imienia.
- **Regression:** F-10 (kto dodał / kto kupił), SC-05 karty, SC-07, wylogowanie na SC-09.

## Implementation notes

- Logi: zmiana imienia bez imienia w logu (tylko `userId`).
- Przy wyborze zdarzenia na żywo uwzględnij, że klient ignoruje zdarzenia pozycji z nie-nowszym `updatedAt` — zmiana imienia nie zmienia `updatedAt` pozycji.

## Definition of done

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [x] Global definition of done from `docs/architecture/testing-strategy.md` met
- [x] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [x] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Run 2026-11-02 (implementer, autonomous). Commands from the backend and web layer guides.

**Live-event choice (Context):** no new event. After `PATCH /api/v1/me` the server sends `members.changed` to every list where the person is owner or participant, and one `lists.changed` (deduplicated) to everyone with access to those lists, the person included (SC-05 in another tab). On `members.changed` the client already refetches the list details (items with `addedBy` / `checkedBy`) and the members (`useLiveList`, T-058). That gets round the client ignoring item events with a non-newer `updatedAt` (Implementation notes). Wiring: `konta` exposes `Accounts.announceNameChanges` (dependency inversion, same pattern as `acceptInvitationsOnSignUp`); `listsModule` registers `announceRenamedPerson` (`listy/http/person-events.ts`). Events go out after the single-statement `UPDATE` has committed.

**Proposal for the owner (not edited, `docs/architecture/` is outside the implementer's scope):** in `api.md`, the "Kiedy" column of the `members.changed` row should also say "zmiana imienia uczestnika lub właściciela (klient pobiera uczestników i pozycje)".

### TDD plan tests

| # | Test | Red (before the code) | Now |
| --- | --- | --- | --- |
| 1 | `apps/api/test/me.name.test.ts` (2 tests: new name in `me`, `GET /lists` (owner and members), `…/members`, item `addedBy` / `checkedBy`; repeating the same name = 200) | `expected 404 to be 200` (no route) | pass |
| 2 | `apps/api/test/me.name.validation.test.ts` (8 refusal cases: empty, spaces only, missing, 31 characters, U+202E, U+200B on its own, U+0007, NUL; 30 characters with Polish letters and emoji; extra fields `email`/`id`/`emailVerified` ignored) | The protection is the shared `requiredName` (T-060). Spot-check: with the schema temporarily set to `z.object({ name: z.string().trim() }).passthrough()`, 8 failed (`expected 200 to be 400`, `expected 500 to be 400` for 31 characters and NUL, a different `fields` for missing). Schema restored | pass |
| 3 | `apps/api/test/me.name.authz.test.ts` (anonymous 401, foreign `Origin` 403 `invalid_origin` and name unchanged) | 401: route 404 before the code. 403 spot-check: with `trustedOrigin` temporarily switched off in `app.ts`, `expected 200 to be 403`; restored | pass |
| 4 | `apps/api/test/live.name.test.ts` (members.changed for both of the person's lists, exactly one lists.changed for Ania and Ola, lists.changed for Tomek, silence for Ewa, who shares no list with him, and no event for Ania's list that Tomek is not on; a person without lists changes the name without any event) | `no "members.changed" within 1000 ms` | pass |
| — | `apps/api/test/logs.content.test.ts` extended (Backend guide, TH-21: new route with personal data): a successful and a refused `PATCH /me` with markers in the name, none of them in the log | test kept green; the route itself logs no name | pass |
| 5 | `apps/web/src/screens/SC-09-konto/AccountScreen.name.test.tsx` (12: field with description and `autocomplete`, save + Toast in `role="status"` + name in the client session (back on SC-09 the field shows "Tomasz" although MSW `GET /me` still returns "Tomek"), Loading with focus kept, double click = 1 request, field errors "" / spaces / 31 characters with focus on the field and no request, field error from the API (`invalid`) with focus, server error "Nie udało się zapisać. Spróbuj ponownie.", offline: "Zapisz imię" `aria-disabled` while "Wyloguj się" works; client state during writes: delayed response does not overwrite text typed later, lost response then repeat succeeds) | 12 × no `textbox "Imię"` (the name was text in a `dl`). Note: the 12 cases were written as one file before the implementation; all failed on the missing field | pass |
| 6 | `apps/web/e2e/j01-zmiana-imienia.spec.ts` (two contexts: "dodał(a) Tomasz" at Ania's on SC-06 ≤ 5 s, then "Tomek B." on SC-07 live ≤ 5 s; axe: form, field error, save error (`page.route` 500), success, offline; `h1` "Konto", `h2` "Twoje dane") | Spot-check: with `accounts.announceNameChanges(...)` commented out (API rebuilt): `expect(locator).toBeVisible() failed, Timeout: 5000ms`; restored and rebuilt | pass (telefon + komputer) |

Regression fixed in passing: `apps/web/e2e/j01-konto.spec.ts` expected the name as text on SC-09; it now checks the value of the "Imię" field (intended change, AC4).

### Acceptance criteria

- AC1: test 1. AC2: test 2. SEC1 (TH-29): test 2 (U+202E, U+200B, control characters, NUL). SEC2: tests 2 (extra fields) and 3.
- AC3: test 4 (events reach the right people, and only them) + test 6 (two contexts, ≤ 5 s, SC-06 and SC-07). SC-05 cards: `lists.changed` to everyone with access (test 4); SC-05 refreshes on `lists.changed` (`LiveProvider`, T-032).
- AC4: test 5. AC5: test 6.

### Full run

- `pnpm vitest run`: 130 files, 886 tests pass. One earlier run had a timeout (`Test timed out in 5000ms`) in `PasswordResetScreen.entry.test.tsx > „zresetuj hasło” under a taken e-mail…` (SC-03, not touched by this task). The JUnit file is saved in the session scratchpad before the rerun (`vitest-junit-T061-full.xml`). The file alone passes (2/2) and the next full run was 886/886. Likely load; QA please watch whether it repeats.
- `pnpm vitest run --project api --sequence.shuffle --sequence.seed=7`: 359 pass.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (0 clones, 0 dependency violations), `pnpm design-check`: OK.
- E2E: full `pnpm test:e2e` before the `j01-konto` fix: 70 passed, 2 failed (`j01-konto`, see above); after the fix `playwright test j01-konto j01-zmiana-imienia`: 12 passed. Local note: Mailpit from an earlier run was still holding port 3125, so I ran with `E2E_MAILPIT_PORT=3177` / `3178`.

### Decisions for QA

- Logs: the route logs no name (only the request log with `userId` from the session is standard); covered by `logs.content.test.ts`.
- Name field: no `maxLength` attribute (as on SC-02), only the counter from 80% and the "too_long" message; this lets the user see the error for 31 characters.
- Change in another tab: the SC-09 field follows the session name while the user has not typed their own; the session refreshes on reload (session `staleTime: Infinity`, no refetch on focus).
- Layer guides: "Gdzie jest kod" updated (backend: `PATCH /me`, `infra/users.ts`, `announceNameChanges`, `person-events.ts`; web: SC-09, `session/personName.ts`, E2E).
