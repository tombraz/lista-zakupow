---
id: T-077
title: "Usunięcie uczestnika: zdarzenie member_removed w logu i 204 niezależnie od rozesłania zdarzeń"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-14]
threats: [TH-21, TH-04]
screens: [SC-07]
related_tasks: [T-058, T-089, T-076]
---

# T-077 Usunięcie uczestnika: zdarzenie member_removed w logu niezależnie od rozesłania zdarzeń

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, P5 (minor). QA T-058 zgłaszało to dwa razy.

- **Actual:** w `apps/api/src/modules/listy/http/routes.ts:133-139` wywołanie `securityEvent("member_removed")` stoi po `await withdrawAccess(...)`. Jeśli `peopleWithAccess` rzuci po zatwierdzonym `DELETE`, właściciel dostaje 500 za udane usunięcie, a w logu bezpieczeństwa brakuje śladu odebrania dostępu.
- **Expected:** ślad `member_removed` zapisuje się zawsze po zatwierdzonym usunięciu, a odpowiedź to 204. `revoke` dalej idzie od razu (TH-04); błąd dalszego rozesłania trafia tylko do logu. Źródło: `T-058-usuniecie-uczestnika.md:48` (SEC4).
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 7c3435f.

## Acceptance criteria

- [x] AC1: Given `peopleWithAccess` rzuca po zatwierdzonym usunięciu, when `DELETE …/members/:userId`, then 204, w logu jest `member_removed`, a `revoke` dla usuniętej osoby zostało wykonane. — verified by: test integracyjny (`captureLogs`, podstawione repozytorium albo `gated-pool`)
- [x] AC2: No regression in: T-058 (wszystkie AC i SEC), T-059.

## TDD plan

**Seam:** trasa przez `buildTestApp`, `captureLogs()`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Błąd po DELETE: 204 + `member_removed` + `revoke` | integration | Vitest + Testcontainers | AC1 |

**Run:** `pnpm vitest run --project api members`

## QA plan

- **Regression:** usunięcie uczestnika z SC-07 przy dwóch klientach WS.
- **Edge cases:** ponowienie po 500 (404 traktowane jako sukces w web).
- **Platforms:** API.

## Root cause

Od T-058 (usunięcie uczestnika) trasa `DELETE …/members/:userId` wołała `withdrawAccess` (odczyt `peopleWithAccess` i rozesłanie zdarzeń) wprost po zatwierdzonym `DELETE`, bez obsługi błędu, a `securityEvent("member_removed")` stał dopiero po nim — wyjątek z bazy albo huba szedł do globalnej obsługi błędów (500) i pomijał ślad TH-21. Testy tego nie wykryły, bo każdy test trasy miał działającą bazę i hub. Przyczynę usunęło już T-089 (005b64e): `withdrawAccess` idzie przez `afterCommit`, więc błąd trafia tylko do logu, a `member_removed` i 204 następują zawsze; `revoke` w `announceAccessChanges` idzie synchronicznie przed odczytem osób (MC-03). T-089 testowało tę trasę z zawodzącym hubem; T-077 dodaje dokładny przypadek z AC1 — błąd bazy w `peopleWithAccess` — i sprawdza `revoke` oraz pola `member_removed`.

**Zmiana kodu produkcyjnego:** brak (naprawione w T-089). **Inne wystąpienia:** `POST …/leave` korzysta z tego samego `withdrawAccess` (pokryte testem T-089); reguła lintu `API_AFTER_COMMIT_SYNTAX` pilnuje pozostałych tras.

## Evidence

- Test: `apps/api/test/lists.announce-failure.test.ts` › „DELETE /api/v1/lists/:listId/members/:userId answers 204, logs member_removed and revokes when reading the people fails” (`failingPool` na zapytaniu `peopleWithAccess`, hub z podsłuchem `revoke`, `captureLogs`).
- Na kodzie produkcyjnym sprzed T-089 (`apps/api/src` z 005b64e^, osobny worktree): czerwony — `AssertionError: expected 500 to be 204`.
- Na HEAD (29e6153): zielony; `pnpm check` (format, lint, typy, depcruise, backlog, testy) i `pnpm build` bez błędów; `pnpm test` — 151 plików / 1182 testy zielone (w tym `live.remove-member`, `lists.remove-member*`, T-058, T-059).

## Prevention

**Co by temu zapobiegło:** jeden wymuszony pomocnik „po zatwierdzeniu” i testy tras z zawodzącym hubem/bazą. Zrobione w T-089: `src/http/after-commit.ts`, reguła eslint `API_AFTER_COMMIT_SYNTAX`, wpis w „Pułapkach” `layers/backend.md`, `test/failing-live.ts`. Nowej prewencji nie proponuję; jedyna luka (ślad bezpieczeństwa po rozesłaniu) jest teraz pokryta testem T-077.

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-04)

Verdict: pass

Zakres: zmiana tylko w teście (`194732a`, `apps/api/test/lists.announce-failure.test.ts`); kod produkcyjny naprawiony wcześniej w T-089 (`withdrawAccess` przez `afterCommit`, `routes.ts:139-176`).

- Odtworzenie: `pnpm vitest run --project api members announce-failure` — 5 plików / 20 testów zielonych; `pnpm check` (format, lint, typy, depcruise, backlog, testy) — 151 plików / 1182 testy web+api zielone, mobile 10/10.
- AC1 — **pass**. Test podmienia `failingPool` tylko na zapytaniu `peopleWithAccess` (asercja „dokładnie jeden `live_announce_failed`” dowodzi, że błąd faktycznie wystąpił), sprawdza 204, brak członkostwa w bazie, `revoke` = `[[bartek, list]]`, `member_removed` z `listId`/`userId`/`removedUserId` i brak danych osobowych w logu.
- AC2 — **pass**. `lists.remove-member*.test.ts`, `live.remove-member.test.ts`, `lists.leave*`, `live.leave` (T-058, T-059) zielone w pełnym przebiegu.
- Spot-checki (każdy cofnięty, `git status` czysty):
  1. `revoke` uzależnione od odczytu osób (`membership-events.ts:55`) → nowy test czerwony: `expected [] to deeply equal [ [ …(2) ] ]` (TH-04 pilnowane).
  2. Usunięte `securityEvent("member_removed")` → 2 testy czerwone: `expected [] to deep equally contain ObjectContaining{…}` (TH-21 pilnowane).
  3. `withdrawAccess` bez `afterCommit` → 3 testy czerwone: `expected 500 to be 204` (zgodne z czerwonym dowodem w Evidence).
- Root cause: wyjaśnia, czemu testy tego nie złapały (zawsze działająca baza i hub) — kompletne.
- Bezpieczeństwo / TH-21, TH-04: negatywne testy autoryzacji trasy istnieją (`lists.remove-member.authz.test.ts`: 403 dla uczestnika, 404 bez dostępu, 401 anonimowo); ślad bezpieczeństwa bez imion i e-maili (asercja w nowym teście). Brak nowej powierzchni ataku — zmiana wyłącznie testowa.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | Testy | W nowym teście podsłuch `revoke` jest zrobiony ręcznym nadpisaniem metody huba; ten sam wzorzec może się przydać w innych testach `announce-failure`. | `lists.announce-failure.test.ts:120-125` | Ewentualnie pomocnik w `test/failing-live.ts`, gdy pojawi się drugie użycie. |
