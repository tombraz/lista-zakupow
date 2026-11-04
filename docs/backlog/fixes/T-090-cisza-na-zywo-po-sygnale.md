---
id: T-090
title: "Testy na żywo: „brak zdarzenia” sprawdzany po sygnale zamiast 300 ms ciszy"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: []
threats: []
screens: []
related_tasks: [T-082]
---

# T-090 Testy na żywo: „brak zdarzenia” sprawdzany po sygnale zamiast 300 ms ciszy

## Report

Źródło: T-082 („Root cause”, inne wystąpienia), przegląd `docs/reviews/E-02-2026-11-02-1.md`, C3. Gałąź: `fix/T-090-<slug>` z `main` po merge poprawek E-02 (PR #14).

- **Actual:** `LiveClient.expectSilence(ms = 300)` (`apps/api/test/live.ts`) czeka stały czas i sprawdza, że nie przyszło zdarzenie. Zdarzenie wysłane po 300 ms (regresja, wolne CI) przechodzi niezauważone; każde wywołanie dokłada 300 ms do testu. Wystąpienia: `live.authz.test.ts:62`, `live.heartbeat.test.ts:32`, `live.leave.test.ts:72`, `live.limits.test.ts:168`, `live.lists.test.ts:66, 77, 78, 188`, `live.name.test.ts:67, 89`, `live.remove-member.test.ts:65`, `live.revoke.test.ts:55, 106, 133`, `live.rollback.test.ts:47`.
- **Expected:** asercja negatywna dopiero po sygnale, że praca, która mogła wysłać zdarzenie, się skończyła (`testing-strategy.md:41`, `CODING_STANDARDS.md` „Niestabilny test”).

## Acceptance criteria

- [ ] AC1: Given test „klient nie dostaje zdarzenia”, when zdarzenie przyszłoby później niż dziś sprawdzana cisza, then test jest czerwony. — verified by: kontrola ręczna: tymczasowo opóźnione rozesłanie w hubie (np. 400 ms) daje czerwone testy z listy w Report (Evidence), zmiana cofnięta
- [ ] AC2: Given wszystkie wystąpienia z Report, then żadne nie używa `expectSilence` ani stałej pauzy; `expectSilence` usunięte z `live.ts` (albo zastąpione helperem opartym na sygnale). — verified by: `grep` w Evidence
- [ ] AC3: Given zmienione pliki, then przechodzą 20 razy pod `--sequence.shuffle`. — verified by: wynik pętli w Evidence
- [ ] AC4: No regression in: pełny projekt `api`; czas zmienionych plików nie rośnie (raport Vitest przed/po).

## TDD plan

**Seam:** klient testowy `apps/api/test/live.ts` (WebSocket z kolejką wiadomości), hub na żywo przez API HTTP/WS.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Helper sygnału (np. „bariera”: zdarzenie, które na pewno dotrze do tego klienta tą samą drogą co sprawdzane; wiadomości jednego gniazda przychodzą po kolei) — z opóźnionym rozesłaniem czerwony | integration | Vitest + Testcontainers | AC1 |
| 2 | Migracja wystąpień plik po pliku | integration | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api live.`

## QA plan

- **Regression:** projekt `api` w losowej kolejności (`--sequence.shuffle`); testy TH-04 (brak zdarzeń dla obcych list) nadal dowodzą tego samego.
- **Edge cases:** klient bez subskrypcji (bariera musi do niego dotrzeć inaczej niż przez listę); obciążony CPU (`--pool threads`, wiele workerów).
- **Platforms:** CI.

## Implementation notes

Bariera nie może iść inną drogą niż sprawdzane zdarzenie (np. prosto do gniazda z pominięciem huba), bo wtedy nie dowodzi kolejności. Jeśli dla części przypadków nie ma takiej drogi, zapisz to jako brakujący seam (`/fix`, krok 4.3) i ustal z użytkownikiem.

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

Reguła ESLint w T-092.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
