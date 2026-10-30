---
id: T-036
title: "Niestabilny test: zwolnienie slotu połączenia na żywo po zamknięciu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: []
threats: [TH-25]
screens: []
related_tasks: [T-033, T-035]
---

# T-036 Niestabilny test: zwolnienie slotu połączenia na żywo po zamknięciu

## Report

Źródło: pełny przebieg testów w T-035 (2026-10-30), przyjęte przez użytkownika jako osobne zadanie.

- **Actual:** `apps/api/test/live.limits.test.ts › frees a slot when a connection closes` padł raz w pełnym przebiegu `pnpm test`; w izolacji (3×) i w kolejnym pełnym przebiegu zielony.
- **Expected:** test deterministyczny; po zamknięciu jednego z `connectionsPerSession` połączeń nowe połączenie zostaje otwarte. — source: T-033 / TH-25
- **Steps to reproduce:** `pnpm test` (pełny zestaw, pod obciążeniem); nie odtwarza się w izolacji.
- **Environment:** lokalnie, Windows; gałąź `epic/E-01-szkielet-i-wspolna-lista`.
- **Evidence:** T-035, sekcja Evidence. Hipoteza: klient widzi zamknięcie (`first.closed()`), zanim serwer obsłuży `close` i wywoła `hub.detach`, więc kolejne `connect()` trafia na pełny limit. Do potwierdzenia: test czy kod (czy limit może odrzucić prawidłowego klienta po szybkim ponownym połączeniu).

## Acceptance criteria

- [ ] AC1: Given 5 otwartych połączeń sesji, when klient zamknie jedno i od razu połączy się ponownie, then nowe połączenie zostaje otwarte — deterministycznie (pętla wielu powtórzeń bez błędu). — verified by: `live.limits.test.ts`
- [ ] AC2: No regression in: T-033, `live.limits.test.ts`, `limits.security.test.ts` (`connectionsPerSession`).

## TDD plan

**Seam:** WebSocket (`connectLive`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `frees a slot when a connection closes` powtórzony N razy / z wymuszonym opóźnieniem obsługi `close` | integracja | Vitest + Testcontainers | AC1 |

**Run:** `pnpm vitest run --project api live.limits`

## QA plan

- **Regression:** T-033, limity połączeń na żywo.
- **Edge cases:** zamknięcie przez klienta vs przez serwer; wylogowanie (`closeSession`).
- **Platforms:** API.

## Root cause

<Wypełnia /fix.>

## Evidence

## Prevention

## Incident note

<Nie dotyczy.>
