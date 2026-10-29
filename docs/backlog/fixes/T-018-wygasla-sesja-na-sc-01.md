---
id: T-018
title: "Wygasła sesja w trakcie pracy przenosi na SC-01"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-02]
threats: []
screens: [SC-01, SC-05, SC-06]
related_tasks: [T-004, T-005, T-009]
---

# T-018 Wygasła sesja w trakcie pracy przenosi na SC-01

## Report

- **Actual:** Gdy sesja wygaśnie albo zostanie wylogowana w innej karcie, `/api/v1/*` zwraca 401; SC-05 / SC-06 pokazują „Nie udało się wczytać…” z bezskutecznym „Spróbuj ponownie”, a `LiveSocket` ponawia połączenie bez końca. 401 obsługuje tylko `/me` (`apps/web/src/api/account.ts:25`), które ma `staleTime: Infinity` (`apps/web/src/session/useSession.ts:9`).
- **Expected:** Odpowiedź 401 z `/api/v1/*` czyści sesję w kliencie i prowadzi na SC-01 (z powrotem na ekran po zalogowaniu); WS przestaje ponawiać — source: T-004 AC6, `docs/design/screens/SC-05-moje-listy.md:50`
- **Steps to reproduce:**
  1. Zaloguj się w dwóch kartach, w jednej wyloguj.
  2. W drugiej „Spróbuj ponownie” / ponowne pobranie SC-05 → komunikat błędu zamiast SC-01.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #P2.

## Acceptance criteria

- [ ] AC1: Given zalogowany na SC-05, when `GET /api/v1/lists` zwraca 401, then użytkownik trafia na SC-01, a po zalogowaniu wraca na SC-05. — verified by: test komponentu (MSW 401)
- [ ] AC2: Given SC-06 z aktywnym WS, when sesja wygasa, then po 401 WS nie ponawia połączenia. — verified by: test komponentu `LiveSocket` / E2E J-01
- [ ] AC3: No regression in: logowanie (401 z błędnym hasłem nie może wylogowywać), SC-08 dla niezalogowanego, wylogowanie z SC-09.

## TDD plan

**Seam:** `queryClient` / klient API web

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | <odtwarza błąd — uzupełnia /fix> | | | AC1 |

**Run:** `pnpm --filter @lista/web test`

## QA plan

- **Regression:** logowanie (401 z błędnym hasłem nie może wylogowywać), SC-08 dla niezalogowanego, wylogowanie z SC-09
- **Edge cases:** <uzupełnia /fix>
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

<Uzupełnia /fix.>

## Evidence

<Uzupełnia /fix.>

## Prevention

<Uzupełnia /fix; propozycje w `docs/reviews/E-01-2026-10-29-1.md`, sekcja „Proposals”.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->
