---
id: T-091
title: "Testy pingu, limitów połączeń i Brevo: sygnał zamiast pauzy i „still open” po czasie"
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

# T-091 Testy pingu, limitów połączeń i Brevo: sygnał zamiast pauzy i „still open” po czasie

## Report

Źródło: T-082 („Root cause”, inne wystąpienia), przegląd `docs/reviews/E-02-2026-11-02-1.md`, C3. Gałąź: `fix/T-091-<slug>` z `main` po merge poprawek E-02 (PR #14).

- **Actual:**
  - `live.heartbeat.test.ts:36, 40` — `pause(100)` po `pong`; `:43`, `:53` — `closed(200|100)` z `rejects.toThrow("still open")`.
  - `live.limits.test.ts:66, 78, 89, 126, 144` — `closed(n)` + „still open”; `:113` — `pause(100)` przed liczeniem gniazd serwera; `:122` — `pause(closeTimeout + 300)` w czasie rzeczywistym.
  - `live.session.test.ts:57` — `closed(200)` + „still open” przed upływem pingu.
  - `brevo-mailer.test.ts:120, 125` — odpytywanie co `pause(5)`.
- **Expected:** czekanie na sygnał (zdarzenie gniazda, odebrany ping, licznik przez `vi.waitFor`, obietnica adaptera, podstawiony zegar), asercja negatywna po sygnale końca pracy (`testing-strategy.md:41`).

## Acceptance criteria

- [ ] AC1: Given test „połączenie zostaje otwarte”, then dowodzi tego zdarzenie po fakcie (np. kolejny odebrany ping albo odpowiedź serwera na tym gnieździe), nie upływ czasu. — verified by: mutacja w Evidence (np. zamknięcie połączenia z opóźnieniem 300 ms daje czerwony test), zmiana cofnięta
- [ ] AC2: Given `live.limits` „releases closing sockets after the close timeout”, then nie czeka `closeTimeout + 300` ms w czasie rzeczywistym (zegar podstawiony albo sygnał zwolnienia gniazda). — verified by: czas testu w raporcie Vitest < 500 ms
- [ ] AC3: Given `brevo-mailer` „gives up after 10 s”, then czeka na obietnicę (`fakeBrevo` „rozpoczęto”, wynik `send`), bez pętli z `pause`. — verified by: przegląd kodu + test zielony
- [ ] AC4: Given wszystkie wystąpienia z Report, then przechodzą 20 razy pod `--sequence.shuffle`; w tych plikach nie ma `pause(` ani „still open”. — verified by: pętla i `grep` w Evidence
- [ ] AC5: No regression in: pełny projekt `api`.

## TDD plan

**Seam:** klient testowy `apps/api/test/live.ts`, `fakeBrevo` (`apps/api/test/brevo.ts`), API HTTP/WS.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `live.heartbeat` i `live.session:57` bez pauzy i „still open” | integration | Vitest + Testcontainers | AC1, AC4 |
| 2 | `live.limits` z sygnałami (w tym zegar dla close timeout) | integration | Vitest + Testcontainers | AC1, AC2, AC4 |
| 3 | `brevo-mailer` z obietnicą „rozpoczęto” | integration | Vitest | AC3 |

**Run:** `pnpm vitest run --project api live.heartbeat live.limits live.session brevo-mailer`

## QA plan

- **Regression:** projekt `api` w losowej kolejności; T-036/T-037 (gniazda bez FIN, TH-25) nadal dowodzą limitu.
- **Edge cases:** obciążony CPU (`--pool threads`, wiele workerów); podstawiony zegar nie może zatrzymać IO testu (wzorzec `wait` w `live.ts` i `gated-pool.ts`).
- **Platforms:** CI.

## Implementation notes

Limity czasu jako wykrywacz awarii (`next(type, timeoutMs)`, `closed()` czekające na zamknięcie) są w porządku — wtedy pada test pozytywny. Zakaz dotyczy czasu jako dowodu, że coś się *nie* stało.

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

Reguła ESLint w T-092.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
