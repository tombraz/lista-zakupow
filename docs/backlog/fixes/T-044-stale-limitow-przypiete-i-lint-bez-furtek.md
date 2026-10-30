---
id: T-044
title: "Wszystkie stałe limitów przypięte liczbą; reguły lintu z przeglądów bez wyłączania komentarzem"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend, web]
requirements: []
threats: [TH-21]
screens: []
related_tasks: [T-027, T-028, T-029, T-034, T-035, T-040]
---

# T-044 Wszystkie stałe limitów przypięte liczbą; reguły lintu z przeglądów bez wyłączania komentarzem

## Report

Źródło: przegląd `docs/reviews/E-01-2026-10-30-2.md`, C19, C20.

- **Actual:**
  - Liczbą przypięte są tylko `LIVE_LIMITS` (`packages/shared/test/live.test.ts:47`) i `listsPerOwner` (`lists.limit.test.ts`). Nigdzie nie są przypięte `RATE_LIMITS`, `participantsPerList` ani `HTTP_LIMITS`. Testy `limits.security.test.ts:74-128`, `invitations.rate-limit.test.ts:22,48` i `health-rate-limit.test.ts:86-87` biorą progi ze stałych, więc zła stała przechodzi.
  - `eslint-comments/no-restricted-disable` obejmuje tylko `no-restricted-imports` w web (`eslint.config.js:219-221`). Reguły `no-restricted-syntax` z przeglądów (API: kształt zdarzenia limitu, T-035; web: `mutate(vars, {…})`, T-029; `EntryLink`, T-028) można wyłączyć komentarzem, a takie komentarze już są (`apps/api/src/modules/pozycje/infra/items-repository.ts:158`, `apps/web/src/screens/SC-04-regulamin/TermsScreen.tsx:81`). Reguła `EntryLink` leży w tablicy `WEB_MUTATE_SYNTAX`.
- **Expected:** test limitu przypina wartość z BRD lub threat-model liczbą. Źródło: `docs/architecture/testing-strategy.md:71`. Reguły dodane po przeglądach nie mają furtki bez śladu w konfiguracji.
- **Steps to reproduce:**
  1. Zmień `RATE_LIMITS.invitationLookupPerIp.max` w `packages/shared/src/limits.ts`. `pnpm vitest run` jest zielony.
  2. Dodaj `// eslint-disable-next-line no-restricted-syntax` nad ręcznym `warn({ event: "rate_limited" })` w API. `pnpm lint` jest zielony.
- **Environment:** lokalnie / CI; `b8998c4`.
- **Evidence:** cytaty wyżej.

## Acceptance criteria

- [ ] AC1: Given zmieniona wartość dowolnej stałej w `RATE_LIMITS`, `BUSINESS_LIMITS` lub `HTTP_LIMITS`, when uruchomię testy, then test w `packages/shared/test` pada z nazwą stałej. Wartości oczekiwane pochodzą z BRD i threat-model. — verified by: test jednostkowy
- [ ] AC2: Given komentarz `eslint-disable` dla `no-restricted-syntax` w `apps/api/src` lub `apps/web/src`, when uruchomię `pnpm lint`, then lint pada. Istniejące uzasadnione wyjątki są opisane w `eslint.config.js` (zawężony `files`/`ignores` z komentarzem), nie komentarzem w kodzie. Reguła `EntryLink` ma własną tablicę. — verified by: `pnpm lint` na próbnym komentarzu
- [ ] AC3: No regression in: `pnpm lint`, `pnpm test`, `pnpm quality`.

## TDD plan

**Seam:** stałe w `packages/shared` i konfiguracja ESLint

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `expect(RATE_LIMITS).toEqual({...})`, `BUSINESS_LIMITS`, `HTTP_LIMITS` | unit | vitest | AC1 |

**Run:** `pnpm vitest run packages/shared && pnpm lint`

## QA plan

- **Regression:** cały zestaw testów i lint w CI.
- **Edge cases:** wyjątki w `items-repository.ts:158`, `lists-repository.ts:101`, `TermsScreen.tsx:81`, `session/useSession.ts` (pominięty blok web).
- **Platforms:** CI.

## Root cause

## Evidence

## Prevention

<!-- QA rounds are appended below by /qa-task -->
