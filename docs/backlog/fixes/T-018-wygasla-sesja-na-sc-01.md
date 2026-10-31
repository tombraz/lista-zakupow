---
id: T-018
title: "Wygasła sesja w trakcie pracy przenosi na SC-01"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
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

**Seam:** cała aplikacja web (`renderApp`): API przez MSW, `/api/v1/live` przez podstawiony serwer WS

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `session/sessionEnded.test.tsx` › sends the person to SC-01 when an API read answers 401, and back after signing in (AC1) | komponent | Vitest + RTL + MSW | AC1 |
| 2 | `session/sessionEnded.test.tsx` › sends the person to SC-01 when a save answers 401 (AC1) | komponent | Vitest + RTL + MSW | AC1 (mutacja) |
| 3 | `session/sessionEnded.test.tsx` › signed out in another tab: the dropped live connection leads to SC-01 and is not retried (AC2) | komponent | Vitest + RTL + MSW `ws.link`, sztuczne timery | AC2 |

**Run:** `pnpm --filter @lista/web test`

## QA plan

- **Regression:** logowanie (401 z błędnym hasłem nie może wylogowywać), SC-08 dla niezalogowanego, wylogowanie z SC-09
- **Edge cases:** 401 z błędnym hasłem na SC-01 (strażnik `RequireSession` nie jest wtedy zamontowany, więc nie reaguje); zerwanie WS przy braku sieci (`/me` nie odpowiada → sesja zostaje, WS ponawia jak dotąd); zerwanie WS przy ważnej sesji (`/me` 200 → bez zmian, ponowne połączenie); wylogowanie z SC-09 (to samo `endSession`, cache czyszczony bez `clear()`); po ponownym zalogowaniu brak danych poprzedniej sesji w cache
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

Koniec sesji klient rozpoznawał tylko w `fetchMe` (401 z `/api/v1/me` → `null`), a zapytanie sesji ma `staleTime: Infinity`, więc po zalogowaniu nie było już pobierane. 401 z innych `/api/v1/*` trafiał do ekranu jak każdy błąd („Nie udało się wczytać…”), a `LiveSocket` (T-009) po zerwaniu połączenia tylko je ponawiał. Nie miał jak się dowiedzieć, że API zamknęło je po wylogowaniu (TH-17) i odrzuca kolejne bez sesji. Przy naprawie wyszło też, że `useSetSession(null)` robił `client.clear()` przed ustawieniem `null`. To odcinało obserwatora `useSession` w zamontowanym `RequireSession` od nowej wartości, więc bez nawigacji z formularza strażnik nie reagował.

**Dlaczego testy nie złapały:** testy T-004 (`routes.test.tsx`) sprawdzały tylko anonima od wejścia (`/me` 401), a testy SC-05/SC-06 traktowały odpowiedzi błędu ogólnie (500), bez 401 u zalogowanego. Testy `LiveSocket` sprawdzały ponowne połączenie, ale nie zerwanie po wylogowaniu.

**Inne wystąpienia:** wszystkie zapytania i zapisy `/api/v1/*` idą przez cache TanStack Query, więc obejmuje je jedna subskrypcja (`useEndSessionOnUnauthenticated` w `RequireSession`). Aplikacja mobilna (E-04) nie ma jeszcze kodu.

## Evidence

- Red (przed poprawką), `pnpm exec vitest run src/session/sessionEnded.test.tsx`: 3 × `TestingLibraryElementError: Unable to find role="heading" and name "Zaloguj się"` (SC-05 zostaje z błędem / WS ponawia).
- Green: 3/3; kontrola mutacyjna: bez `live.onDrop(checkSession)` test AC2 znów czerwony.
- Pełny zestaw web 190/190 w trzech kolejnych przebiegach. Wcześniej w jednym przebiegu padł 1 test bez zapisanego logu (znana niestabilność pod obciążeniem, C3 / T-021). Typecheck, lint, prettier i build web przechodzą.
- Poprawka: `apps/web/src/session/useSession.ts` (`endSession`, `useEndSessionOnUnauthenticated`, `useCheckSession`), `session/guards.tsx`, `live/liveSocket.ts` (`onDrop`), `live/LiveProvider.tsx`.

## Prevention

**Co by zapobiegło:** jedno miejsce reakcji na 401 od początku (T-004), test „sesja kończy się w trakcie pracy” na poziomie całej aplikacji, a nie tylko „anonim od wejścia”, i test zerwania WS po wylogowaniu (T-009). Dodatkowo klient musi kończyć sesję tak, żeby `RequireSession` to zobaczył (bez `clear()`).

Przyjęte przez użytkownika (2026-10-30), wszystkie wdrożone:

1. **Lint** (`eslint.config.js`, `WEB_SESSION_SYNTAX`): `no-restricted-syntax` zakazuje `clear()` na `QueryClient` (`*client.clear()`, `useQueryClient().clear()`) w `apps/web/src` poza `session/useSession.ts`. Sprawdzone na pliku próbnym: oba wzorce są błędem, a `Set.clear()` nie.
2. **Testy `useCheckSession`** (uwaga minor QA round 1): `sessionEnded.test.tsx` › keeps the person signed in and reconnects after a dropped connection when the session is still valid / when the session check has no network. Kontrola mutacyjna: gdy błąd sieci kończy sesję, test „no network” jest czerwony.
3. **„Pułapki” w `layers/web.md`**: 401 obsługuje `RequireSession` i `LiveProvider`, a nie ekran; koniec sesji tylko przez `useSetSession(null)`; test na poziomie `renderApp`.
4. **E2E J-01** (`e2e/j01-konto.spec.ts` › J-01 signed out in another tab: goes to SC-01 and back after signing in): wylogowanie przez `page.request` w tej samej sesji (bez drugiej strony, pułapka E2E na Windows), prawdziwe API zamyka WS (TH-17). Wynik: 2/2 (telefon, komputer). Bez `live.onDrop(checkSession)` test jest czerwony.

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-29)

Verdict: pass

Reproduced: `pnpm install --frozen-lockfile` (no tracked changes), `pnpm test` 428/428 (web 190/190), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (0 clones, 0 dependency violations), `pnpm design-check` OK. Task tests `src/session/sessionEnded.test.tsx` 3/3.

Acceptance criteria:

- AC1 pass: tests 1 and 2 drive the whole app (`renderApp`) with MSW 401 on `GET` and `POST /api/v1/lists`; they assert SC-01 heading, `/logowanie`, and after sign-in a return to `/listy` with fresh data. Spot-check: without `useEndSessionOnUnauthenticated()` in `RequireSession` both go red.
- AC2 pass: test 3 drops the live connection with `/me` = 401 and asserts SC-01 and no new connection after 15 s (`connections()` counts all connections ever opened, so a retry would be caught). Spot-check: without `live.onDrop(checkSession)` it goes red.
- AC3 pass: SC-01 wrong password (`SignInScreen.test.tsx`, `RequireSession` not mounted there), SC-08 and SC-09 sign-out suites green.

Exploratory (temporary test, removed): WS drop with valid session (`/me` 200) and with `/me` network error both stay on SC-05 and reconnect; a 403 from `/api/v1/lists` does not end the session. Root cause explains why earlier tests missed it; red evidence recorded. Threats: none listed; no server change.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | Tests | QA-plan edge cases "drop without network" and "drop with valid session" are not covered by committed tests (only checked by QA with a temporary test). | `sessionEnded.test.tsx` has 3 tests, all 401 paths | A regression test for `useCheckSession` ignoring network errors and keeping the session on `/me` 200. |
| 2 | note | Verification | AC2 is proven against MSW `ws.link`, not against the real API refusing the upgrade without a session; the E2E J-01 alternative in the AC was not added. | TDD plan rows 1-3 are component level | Optional E2E: sign out in a second context, check the first lands on SC-01. |
| 3 | note | Backlog | `## Prevention` is still the placeholder. | task file | Filled by `/fix` follow-up, as with T-024. |
