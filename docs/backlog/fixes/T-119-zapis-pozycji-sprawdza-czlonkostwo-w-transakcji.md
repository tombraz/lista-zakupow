---
id: T-119
title: "Zapis pozycji sprawdza członkostwo w transakcji; usunięcie uczestnika szereguje się z zapisami"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: in-progress        # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend, db]
requirements: [F-13]
threats: [TH-04, TH-31]
screens: []
related_tasks: [T-056, T-058, T-059, T-029]
---

# T-119 Zapis pozycji sprawdza członkostwo w transakcji; usunięcie uczestnika szereguje się z zapisami

## Report

Źródło: przegląd bezpieczeństwa `docs/security/reviews/E-02-2026-11-10-1.md`, znalezisko #2 (medium).

- **Actual:** trasy pozycji wołają `requireListAccess` osobnym zapytaniem przed transakcją zapisu (`apps/api/src/modules/pozycje/http/routes.ts:79-81`, także 91, 113, 122). W transakcji członkostwo nie jest sprawdzane drugi raz. `insert` bierze `lockList` (`items-repository.ts:45`), ale nie sprawdza pod nią członkostwa. `update`, `delete` i `check` (75, 114, 137) nie biorą blokady. `removeParticipant` (`listy/infra/lists-repository.ts:149-155`) i opuszczenie listy to `DELETE FROM list_member` bez `lockList`. Zapis, który już trwa w chwili usunięcia uczestnika, kończy się sukcesem (201 / 200), a zmiana zostaje w bazie.
- **Expected:** po zatwierdzeniu usunięcia albo opuszczenia listy żaden zapis tej osoby na tej liście się nie udaje (404 `not_found`). Źródło: TH-04 („zapisy zawsze sprawdzają dostęp w bazie… zapis zwraca 404”), MC-03, plan QA T-058.
- **Steps to reproduce:** przekazane właścicielowi poza repozytorium (repozytorium publiczne); dopisać tu po wydaniu poprawki.
- **Environment:** lokalnie, `cad0509`; analiza kodu (wyścig nie był odtwarzany na żywo).
- **Evidence:** cytaty z kodu powyżej; `gatedPool` jest użyty tylko dla `subscribe` (`live.revoke.test.ts`).

## Acceptance criteria

- [ ] AC1: Given zapis pozycji uczestnika (dodanie, edycja, odhaczenie, cofnięcie odhaczenia, usunięcie, wyczyszczenie kupionych) wstrzymany po sprawdzeniu dostępu, when właściciel usuwa tego uczestnika, a potem zapis zostaje wznowiony, then zapis odpowiada 404 `not_found`, a w bazie nie ma zmian. — verified by: test integracyjny z `gatedPool` dla każdej trasy zapisu
- [ ] AC2: To samo dla opuszczenia listy i dla usunięcia konta uczestnika. — verified by: test integracyjny
- [ ] AC3: Równoległe zapisy członków na jednej liście nie wywołują zakleszczeń ani 500 (kolejność blokad: lista, potem pozycja). — verified by: istniejące testy równoległości (T-029, T-030)
- [ ] AC4: No regression in: `live.remove-member.test.ts`, `live.leave.test.ts`, `items*.test.ts`, J-03, J-05.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) z bazą Testcontainers i `gatedPool`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `refuses an item write that started before the participant was removed` (każda trasa zapisu) | integracja | Vitest + Testcontainers | AC1 |
| 2 | `refuses an item write that started before the participant left or deleted their account` | integracja | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api items live.remove-member`

## QA plan

- **Regression:** J-03 (pozycje), J-04 (uczestnicy), J-05 (na żywo), limity pozycji (500), blokada duplikatu (F-09).
- **Edge cases:**
  - właściciel usuwa listę w trakcie zapisu uczestnika;
  - dwie osoby odhaczają tę samą pozycję;
  - zapis właściciela w trakcie usuwania uczestnika (musi się udać).
- **Platforms:** API.

## Root cause

Trasy pozycji sprawdzały dostęp (`requireListAccess`) osobnym zapytaniem przed transakcją zapisu — wzorzec „sprawdź, potem zapisz” z E-01. Transakcja zapisu nie sprawdzała członkostwa ponownie, a nic nie szeregowało jej ze zmianą członkostwa, więc zapis rozpoczęty przed usunięciem uczestnika, opuszczeniem listy albo usunięciem konta kończył się po nim sukcesem (przy usunięciu konta: 500 z naruszenia klucza obcego `added_by`). Testy TH-04 sprawdzały tylko zapis wysłany po usunięciu, nigdy zapis w toku.

**Poprawka:** `lockListFor` (`listy/infra/lists-repository.ts`) w każdej transakcji zapisu pozycji (`insert`, `update`, `delete`, `check`, `deleteChecked`): blokada listy (`lockList`, `FOR UPDATE`), potem członkostwo z `FOR SHARE` na wierszu `list_member`. Brak dostępu = 404 `not_found`. Blokada wiersza członkostwa szereguje zapis z usunięciem uczestnika, opuszczeniem listy i kaskadą usunięcia konta bez zmian w tych ścieżkach. Kolejność blokad w zapisach: lista, członkostwo, pozycja (dotąd `update`/`check` blokowały pozycję przed listą przez `touchList`).

**Ten sam wzorzec gdzie indziej:** zaproszenia (`invitations-repository.ts`) biorą `lockList`, ale sprawdzają rolę właściciela przed transakcją — właściciela listy nie da się odebrać, więc bez skutku; zmiana nazwy i usunięcie listy (właściciel) jak wyżej. Subskrypcja na żywo ma własne zabezpieczenie (T-056).

## Evidence

- Test `apps/api/test/items.membership-race.test.ts` (seam HTTP, `gatedPool` wstrzymuje wynik `roleOf`, usunięcie przez drugą aplikację na niewstrzymanej puli). Przed poprawką 9/9 czerwone:
  - `refuses an item write (add|edit|check|uncheck|delete|clear checked) that started before the participant was removed (AC1)`: `expected 201 to be 404` (add, edit, check, uncheck), `expected 200 to be 404` (clear checked), `expected 204 to be 404` (delete);
  - `… participant left (AC2)`: `expected 201 to be 404`; `… participant deleted their account (AC2)`: `expected 500 to be 404`;
  - `makes removing a participant wait for their write already in its transaction`: `0 of 1 results held` (w transakcji nie było sprawdzenia członkostwa).
- Po poprawce: 9/9 zielone; pełny zestaw 158 plików / 1290 testów zielony, `--sequence.shuffle --sequence.seed=119` dla `api` zielony; typecheck, lint, `format:check`, build czyste.

## Prevention

Propozycja z przeglądu: linia w `backend.md` „Zasady bezpieczeństwa” — „Zapis do danych listy sprawdza członkostwo w tej samej transakcji pod `lockList`; każda zmiana członkostwa bierze tę samą blokadę”.

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-13)

Verdict: fail

Reproduce: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` clean; `pnpm test` 1290/1290 green (junit: 0 failures). `items.membership-race.test.ts` 9/9 green.

Acceptance criteria:

- AC1 pass: 6 routes, each 404 `not_found` and DB snapshot unchanged; spot-check (`lockListFor` returning `true` for everyone) turns all 9 tests red.
- AC2 partial: covered when the write is held **before** its transaction (404, no change). When the write is already **in** its transaction (holds `list_member FOR SHARE`), account deletion deadlocks with add/check; see #1.
- AC3 pass: T-029/T-030 concurrency tests green; QA mix of an owner add, a participant removal, an owner check and a member check in parallel gave `[201, 204, 200, 404]`, no 500.
- AC4 pass: full suite green.

Exploratory (temporary probe `apps/api/test/zz-qa-probe.test.ts` with `gatedPool(/FOR SHARE/i, { clients: true })`, removed afterwards). An owner deleting the list during a member's in-transaction add gave 201 then 204. Edit and delete across account deletion gave 200/204 then 204.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | major | backend/db, TH-31 | Account deletion deadlocks with the same user's in-transaction item write that writes a user FK (add: `added_by`, check: `checked_by` + `recordCheck`). The write holds `list_member FOR SHARE` and waits for `FOR KEY SHARE` on `user`. `deleteAccount` (`konta/infra/users.ts:35-47`) holds `user FOR UPDATE` and its cascade waits for the `list_member` row. Postgres aborts the deletion, so `DELETE /api/v1/me` returns 500 `internal` and the user must retry. The root-cause claim that the account-deletion cascade serialises "bez zmian w tych ścieżkach" does not hold. Before this fix the same race gave a 500 on the write. Now the 500 lands on the account deletion. | Probe: write held after `FOR SHARE`, then `DELETE /me` by the participant, then release: add gave 201 and removal **500** (1399 ms); check gave 200 and removal **500** (1240 ms). Edit and delete (no user FK) gave 204 in about 270 ms. The 1.2-1.4 s matches `deadlock_timeout` (1 s). | No deadlock and no 500 (AC3, TH-31: "zmiany członkostwa (… usunięcie konta) pod tą samą blokadą"). Make account deletion take locks in the write order: lists before membership before user. For example, lock the joined lists (`lockList`) and the account's `list_member` rows before `user FOR UPDATE`, or lock `list_member` first. Add an integration test: write held inside its transaction, account deleted, then 2xx/404 for the write and 204 for the deletion. |
| 2 | minor | docs | The layer guides do not describe the new rule or helper. `docs/architecture/layers/backend.md:30` and `:33` and `docs/architecture/layers/db.md:29` mention only `lockList`, not `lockListFor`, and not that every item write rechecks membership under the list lock (`FOR SHARE` on `list_member`). Neither guide has a change-log row for T-119. The "Prevention" line proposed for `backend.md` "Zasady bezpieczeństwa" is not added. | `grep lockListFor docs/architecture` finds nothing | "Gdzie jest kod", the security rules and the change log in `backend.md` and `db.md` updated |
| 3 | note | threat model | The TH-31 mitigation says membership changes run "pod tą samą blokadą" (list lock). The fix serialises them through the `list_member` row lock instead, and `removeParticipant` and leave do not take `lockList`. The behaviour is correct for removal and leave. Update the TH-31 text, or align the code once #1 is fixed. | `threat-model.md:94`, `lists-repository.ts` `removeParticipant` | Mitigation text matches the mechanism |
| 4 | note | task | "Steps to reproduce" still says "dopisać tu po wydaniu poprawki". | Report section | Fill in at release |

Root cause section: it explains why the existing tests missed the bug (they only covered a write sent after removal). The reproducing tests fail without the fix (spot-check above).

Must change: #1, with its negative test. Fix #2 in the same round.
