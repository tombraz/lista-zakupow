---
id: T-037
title: "Gniazda WS w trakcie zamykania bez limitu na sesję"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: []
threats: [TH-25]
screens: []
related_tasks: [T-033, T-036]
---

# T-037 Gniazda WS w trakcie zamykania bez limitu na sesję

## Report

Źródło: QA T-036, runda 1, uwaga 3 (2026-10-30); przyjęte przez użytkownika jako osobne zadanie. Luka istniała przed T-036.

- **Actual:** jedna sesja może utrzymywać dowolnie wiele gniazd WebSocket w trakcie zamykania (przyjętych i zamkniętych przez klienta albo odrzuconych kodem 1008): klient, który nie wysyła FIN, trzyma każde gniazdo do `closeTimeout` biblioteki `ws` (30 s). Lokalnie ~100 upgrade'ów/s na sesję; próba z 200 połączeniami: 200 gniazd TCP po 5 s.
- **Expected:** liczba zasobów połączeń na sesję ograniczona (TH-25), także dla gniazd w trakcie zamykania. — source: TH-25
- **Steps to reproduce:** pętla `closeWithoutFin(url, { cookie })` (`apps/api/test/live.ts`) dla jednej sesji; liczba otwartych gniazd TCP po stronie serwera rośnie.
- **Environment:** lokalnie, Testcontainers; gałąź `epic/E-01-szkielet-i-wspolna-lista`.
- **Evidence:** T-036, sekcja QA round 1.

## Acceptance criteria

- [ ] AC1: Given sesja, która otwiera i zamyka połączenia bez FIN, when przekroczy ustalony limit, then kolejne gniazda nie zostają utrzymywane (np. krótki `closeTimeout` / `terminate` po wymianie ramek close / limit upgrade'ów na sesję — do wyboru w `/fix`), a przekroczenie limitu trafia do logu `security` przez `logLimitEvent`. — verified by: `live.limits.test.ts`
- [ ] AC2: No regression in: T-033, T-036, `limits.security.test.ts`.

## TDD plan

**Seam:** WebSocket (`closeWithoutFin`, `connectLive`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | wiele `closeWithoutFin` jednej sesji → gniazda zwalniane / upgrade odrzucany | integracja | Vitest + Testcontainers | AC1 |

**Run:** `pnpm vitest run --project api live.limits`

## QA plan

- **Regression:** T-033, T-036, limity połączeń na żywo.
- **Edge cases:** odrzucone 1008 vs przyjęte i zamknięte; wylogowanie (`closeSession`); nowy limit w `LIVE_LIMITS` i w tabeli `limits.security.test.ts`.
- **Platforms:** API.

## Root cause

<Wypełnia /fix.>

## Evidence

## Prevention

## Incident note

<Nie dotyczy.>
