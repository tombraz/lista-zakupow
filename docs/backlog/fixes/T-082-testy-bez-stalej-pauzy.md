---
id: T-082
title: "Testy API E-02: czekanie na sygnał zamiast stałej pauzy przed asercją"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: []
threats: []
screens: []
related_tasks: [T-053, T-055, T-056]
---

# T-082 Testy API E-02: czekanie na sygnał zamiast stałej pauzy przed asercją

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, C3 (minor).

- **Actual:**
  - `apps/api/test/live.session.test.ts:78-88` (T-056): po `pause(100)` test sprawdza dokładną liczbę zapytań (`toBe(2)`, `toBe(4)`). Na wolnym CI asercja `toBe(4)` może paść, zanim zapytanie dojdzie, a `toBe(2)` przepuści regresję, która wykona dodatkowe zapytanie później.
  - `apps/api/test/password-reset-rate-limit.test.ts:106` i `password-reset.test.ts:134`: `setTimeout(50)`, a potem asercja, że mail nie wyszedł. Test przejdzie, jeśli mail wyjdzie po 51 ms.
  - `password-reset.test.ts:82-91`: asercja czasu zegarowego przy opóźnieniu maila 2000 ms; test trwa około 2,3 s.
- **Expected:** wyścigi testowane bez `sleep`, przez `gated-pool` (`backend.md:40`); negatywne asercje dopiero po sygnale, że praca się zakończyła. Źródło: `CODING_STANDARDS.md:45` („Niestabilny test”).

## Acceptance criteria

- [ ] AC1: Given test T-056, then czeka na `sessions.held(n)` albo `vi.waitFor` na liczniku zamiast `pause`; asercja liczby zapytań po sygnale. — verified by: test zielony 20 razy pod `--sequence.shuffle`
- [ ] AC2: Given testy „mail nie wyszedł”, then czekają na zakończenie zadania wysyłki (np. `capturingMailer` z obietnicą „rozpoczęto/zakończono” albo jawny sygnał „pominięto”), a nie na stały czas. — verified by: kontrola ręczna: tymczasowo opóźniona wysyłka 100 ms daje czerwony test (Evidence), zmiana cofnięta
- [ ] AC3: Given test czasu odpowiedzi resetu, then nie opiera się na zegarze ściennym albo trwa < 500 ms. — verified by: czas w raporcie Vitest
- [ ] AC4: No regression in: pełny projekt `api`.

## TDD plan

**Seam:** helpery testowe `apps/api/test/` (`gated-pool.ts`, `mailer.ts`).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `live.session.test.ts` bez `pause` | integration | Vitest + Testcontainers | AC1 |
| 2 | Testy resetu z sygnałem mailera | integration | Vitest + Testcontainers | AC2, AC3 |

**Run:** `pnpm vitest run --project api live.session password-reset`

## QA plan

- **Regression:** projekt `api` w losowej kolejności (`--sequence.shuffle`).
- **Edge cases:** obciążony CPU (np. `--pool threads` z wieloma workerami).
- **Platforms:** CI.

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

Linia w `testing-strategy.md`: bez `pause`/`setTimeout` przed asercją (przegląd, „Proposals”).

## Incident note

<!-- QA rounds are appended below by /qa-task -->
