---
id: T-044
title: "Wszystkie stałe limitów przypięte liczbą; reguły lintu z przeglądów bez wyłączania komentarzem"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done               # todo | in-progress | in-qa | done | blocked
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

Zasada „test limitu przypina wartość liczbą” (testing-strategy.md, przegląd E-01 runda 2, S13) weszła po napisaniu testów limitów i została zastosowana tylko tam, gdzie wskazał przegląd (`listsPerOwner`, `LIVE_LIMITS`); testy w `apps/api` nadal biorą progi ze stałych, więc zła stała zmienia test i kod razem. Zakaz `eslint-disable` (T-030) objął tylko `no-restricted-imports` w web; reguły `no-restricted-syntax` dodawane później (T-017, T-021, T-028, T-029, T-035) nie rozszerzyły tej listy, więc wyjątki zapisano komentarzem w kodzie. Istniejące testy nie mogły tego wychwycić: nic nie sprawdzało wartości stałych ani samej konfiguracji lintu.

Ten sam wzorzec gdzie indziej (poprawione tutaj, ta sama przyczyna i warstwa): komentarze `no-restricted-syntax` w `apps/api/src/db/schema.ts` (4× `sql.raw` w CHECK), w `ListScreen.live.test.tsx` (4× `delay(100)` po `live.send`) i `ParticipantsScreen.test.tsx` (1× `delay(50)`); `session/useSession.ts` był wyjęty z całego bloku reguł web, nie tylko z `WEB_SESSION_SYNTAX`. Poza zakresem: `apps/web/e2e/j01-konto.spec.ts` (2× `no-restricted-properties`, reguła TH-16, nie z przeglądów) i `react-hooks/exhaustive-deps` w `Modal.tsx`, `useFocus.ts`.

Uwaga: T-008 proponował „20 linków / h na właściciela”, stała i test liczą na listę (`invitationsCreatedPerList`); test przypina stan zaimplementowany.

## Evidence

- AC1 red: `packages/shared/src/limits.ts` z `participantsPerList: 21` — `pnpm vitest run packages/shared --exclude "**/limits.test.ts"`: 31/31 zielone; z nowym plikiem: `FAIL test/limits.test.ts > BUSINESS_LIMITS (F-05, F-07, F-12, TH-13) > keeps the BRD limits 50 / 500 / 20`. Z `invitationLookupPerIp.max: 31`: `FAIL … RATE_LIMITS … > keeps the documented thresholds`, diff `"invitationLookupPerIp": { - "max": 30, + "max": 31 }`.
- AC2 red: próbne `apps/api/src/zz-probe.ts` (`// eslint-disable-next-line no-restricted-syntax` nad `log.warn({ event: "rate_limited" })`) i `apps/web/src/zz-probe.ts` (nad `m.mutate(1, {})`) — `eslint` exit 0.
- AC2 green, te same próby + kontrolne: `Disabling 'no-restricted-syntax' is not allowed`, blanket `eslint-disable-next-line` → `Disabling 'no-restricted-imports,no-restricted-syntax' is not allowed`; bez komentarza nadal błąd T-035; `sql`now()`` w `update(item)` i w `update(shoppingList).set({ name })` → błąd T-017, `update(shoppingList).set({ updatedAt })` dozwolone; `sql.raw(String(LIMIT))` poza schema.ts → błąd; w schema.ts `sql.raw(userInput)` i `sql.raw(String(userInput))` → błąd, `sql.raw(String(NAME_MAX_LENGTH))` dozwolone; `mutate(1, {})` w `TermsScreen.tsx` i `useSession.ts` → błąd T-029; `<Link to="/logowanie">` poza TermsScreen → błąd T-028; w teście web `delay(100)` po `live.send` dozwolone, po `other.send`, bez poprzednika i z instrukcją pomiędzy → błąd T-021.
- Pełny przebieg: `pnpm lint` 0 błędów, `pnpm test` 93 pliki / 515 testów, `pnpm typecheck`, `pnpm build`, `pnpm quality` (0 klonów, 0 naruszeń zależności) zielone. `ParticipantsScreen.test.tsx` 3× zielony z `delay()` zamiast `delay(50)`.

## Regression

- Testy limitów API (`limits.security.test.ts`, `invitations.rate-limit.test.ts`, `health-rate-limit.test.ts`, `lists.limit.test.ts`) — bez zmian, zielone.
- SC-07 „Unieważnij” dwa razy (T-020) — `ParticipantsScreen.test.tsx`; SC-06 na żywo (T-025, T-039) — `ListScreen.live.test.tsx`; SC-04 „Wróć” — `TermsScreen` testy.

## Prevention

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-30)

Verdict: pass

Przebieg (czysty stan, `pnpm install --frozen-lockfile`): `pnpm lint` 0 błędów, `pnpm typecheck` zielony, `pnpm test` 93 pliki / 515 testów zielone, `pnpm quality` 0 klonów, 0 naruszeń zależności. `git status` czysty po przebiegu.

Kryteria:

- **AC1 — pass.** Mutacje w `packages/shared/src/limits.ts` (każda osobno, przywrócone): `healthReadyPerIp.max` 30→31, `signUpPerIp.max` 5→6, `invitationsCreatedPerList.windowSeconds` 3600→1800 → `FAIL … RATE_LIMITS … keeps the documented thresholds`; `participantsPerList` 20→21 → `FAIL … BUSINESS_LIMITS …`; `bodyBytes` 16·1024→16·1000 → `FAIL … HTTP_LIMITS …`. Diff `toEqual` pokazuje nazwę klucza. Wartości oczekiwane zgodne z BRD (50/500/20, BRD.md:130,155,220), api.md:24 (10/min, 5/15 min, 5/h, 30/min), threat-model.md:100 (16 kB) i T-008:176 (30/min, 20/h na listę).
- **AC2 — pass.** Próbne pliki (usunięte): `// eslint-disable-next-line no-restricted-syntax` nad `log.warn({ event: "rate_limited" })` w `apps/api/src`, `/* eslint-disable no-restricted-syntax */` blokowo, `// eslint-disable-line` bez nazwy reguły, w `apps/web/src` nad `mutate(1, {})` i `<Link to="/logowanie">`, w `packages/shared/src` i `apps/mobile/src` → `Disabling 'no-restricted-syntax' is not allowed`. Bez komentarza reguła T-035 nadal pada. Wyjątki zawężone w konfiguracji: `update(shoppingList).set({ updatedAt: sql\`now()\` })` dozwolone, `update(item)`, `set({ createdAt })`, `insert(shoppingList)` → błąd T-017; w `schema.ts` `sql.raw(userInput)`, `sql.raw(String(userInput))`, `` sql.raw(`${STAŁA}`) `` → błąd, `sql.raw(String(ITEM_NOTE_MAX_LENGTH))` dozwolone; w teście web `delay(100)` po `live.send` dozwolone, po `other.send`, bez poprzednika i z instrukcją pomiędzy → błąd T-021; `useSession.ts` z `mutate(1, {})` → błąd T-029. `EntryLink` ma tablicę `WEB_ENTRY_LINK_SYNTAX`. W `apps/*/src`, `packages/*/src`, `apps/web/test` zostały tylko `eslint-disable` dla `react-hooks/exhaustive-deps` (poza zakresem, opisane w Root cause).
- **AC3 — pass.** Jak wyżej.

Jakość testów: test przypina liczby niezależne od implementacji (literały z dokumentów), czerwony dowód w Evidence dla AC1 i AC2, potwierdzony mutacjami. Root cause wyjaśnia, dlaczego istniejące testy tego nie wychwyciły. TH-21: reguła kształtu zdarzenia limitu nie daje się wyłączyć komentarzem (sprawdzone próbą).

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | lint | Zakaz `eslint-disable` obejmuje `packages/*/src/**/*.ts`, bez `.tsx` (dziś brak takich plików). | `eslint.config.js`, blok `no-restricted-disable` | `packages/*/src/**/*.{ts,tsx}`, jak `SOURCE` |
| 2 | note | lint | Wyjątek DDL przepuszcza `sql.raw(String(X))` dla dowolnego identyfikatora w SCREAMING_CASE, nie tylko importowanych stałych długości. | selektor `SAFE_SYNTAX_DDL` | ewentualnie lista dozwolonych nazw (`*_MAX_LENGTH`) |
| 3 | note | lint | Wyjątek `updatedAt` listy przepuszcza dowolne wyrażenie z `now()` (np. `now() + interval '1 day'`) w `update(shoppingList).set`. | próba w `apps/api/src` | akceptowalne; ewentualnie dokładnie `now()` |
| 4 | note | test | Wyjątek T-021 dopuszcza dowolnie długi `delay(ms)` zaraz po `live.send(...)`. | `WEB_TEST_SYNTAX` | akceptowalne, opisane w konfiguracji |
