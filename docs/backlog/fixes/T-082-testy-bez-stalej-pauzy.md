---
id: T-082
title: "Testy API E-02: czekanie na sygnał zamiast stałej pauzy przed asercją"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given test T-056, then czeka na `sessions.held(n)` albo `vi.waitFor` na liczniku zamiast `pause`; asercja liczby zapytań po sygnale. — verified by: test zielony 20 razy pod `--sequence.shuffle`
- [x] AC2: Given testy „mail nie wyszedł”, then czekają na zakończenie zadania wysyłki (np. `capturingMailer` z obietnicą „rozpoczęto/zakończono” albo jawny sygnał „pominięto”), a nie na stały czas. — verified by: kontrola ręczna: tymczasowo opóźniona wysyłka 100 ms daje czerwony test (Evidence), zmiana cofnięta
- [x] AC3: Given test czasu odpowiedzi resetu, then nie opiera się na zegarze ściennym albo trwa < 500 ms. — verified by: czas w raporcie Vitest
- [x] AC4: No regression in: pełny projekt `api`.

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

Testy z T-053 (reset hasła) i T-056 (kontrola sesji przy pingu) nie miały sygnału końca pracy: `capturingMailer` znał tylko dostarczone maile (`sent`), a `gatedPool` tylko wysłane i wstrzymane zapytania — brakowało „wysyłka rozpoczęta” i „wynik oddany”. Autorzy zastąpili sygnał stałą pauzą (`pause(100)`, `setTimeout(50)`) i zegarem ściennym (`performance.now()` przy opóźnieniu 2000 ms). Istniejące testy tego nie łapały, bo są zielone zarówno przy poprawnym kodzie, jak i przy regresji, która zrobi niechcianą pracę po pauzie; nic (lint, CI) nie zabrania stałej pauzy w teście.

Zmiana (tylko testy):
- `test/mailer.ts`: `requested` (wywołania `send`, zapisane synchronicznie) i opcja `hold` + `release()` (dostarczenie czeka na test). Better Auth woła `sendResetPassword` przed odpowiedzią (`runInBackgroundOrAwait(sendResetPassword(...))`), więc `requested` po odpowiedzi jest kompletny — przypina to test SEC1 (`requested` = [ania] bez `waitFor`).
- `test/gated-pool.ts`: `answered()` — pasujące wyniki oddane wywołującemu.
- `live.session.test.ts` (AC2 T-056): sygnałem jest odebrany ping (`onPing` biegnie w tym samym wywołaniu timera co wysłanie pingu, a odbiór przez klienta to późniejsze IO), po `release()` — `vi.waitFor` na `answered()`; „połączenie zostaje” dowodzi kolejny odebrany ping zamiast `closed(100)`.
- `password-reset.test.ts` (SEC5) i `password-reset-rate-limit.test.ts`: `expect(requested)` zaraz po odpowiedzi zamiast `setTimeout(50)` + `sent`.
- `password-reset.test.ts` (SEC1): `capturingMailer({ hold: true })` — odpowiedź przy wstrzymanym mailu i `sent = []` zamiast pomiaru czasu.

Inne wystąpienia tego wzorca (poza zakresem; ta sama przyczyna, ale inne testy z innych zadań — propozycja osobnego zadania):
- `live.heartbeat.test.ts:32-53` (`pause(100)`, `expectSilence(50)`, `closed(200)` rejects),
- `live.limits.test.ts:66-144` (`pause(100)`, `pause(closeTimeout + 300)`, `closed(n)` rejects),
- `live.session.test.ts:57` (`closed(200)` rejects przed upływem pingu),
- `brevo-mailer.test.ts:120-125` (odpytywanie co `pause(5)`),
- `expectSilence()` (300 ms ciszy) w `live.authz`, `live.leave`, `live.lists`, `live.name`, `live.remove-member`, `live.revoke`, `live.rollback`, `live.limits`.

## Evidence

- **Red (przed zmianą helpera):** `pnpm vitest run --project api password-reset.test password-reset-rate-limit` — 3 failed, m.in. `password-reset.test.ts > refuses a foreign or missing Origin with 403 before writing anything`: `AssertionError: expected undefined to deeply equal []` (brak `requested`/`hold`).
- **AC2, kontrola ręczna:** `sendResetMail` tymczasowo z `setTimeout(..., 100)` wokół `mailer.send` → `FAIL password-reset.test.ts > answers identically for an existing and an unknown e-mail, without waiting for the mail (SEC1)`: `AssertionError: expected [] to deeply equal [ Array(1) ]`. Zmiana cofnięta (`git status apps/api/src` czysty).
- **AC1, mutacja:** usunięte `if (checking) return;` w `sessionCheck` (`na-zywo/http/routes.ts`) → `FAIL live.session.test.ts > checks each session at most once per ping ... (AC2)`: `expected 4 to be 2`. Cofnięte.
- **AC1:** `pnpm vitest run --project api live.session password-reset.test password-reset-rate-limit --sequence.shuffle --sequence.seed=<losowy>` × 20 → 20/20 zielone.
- **AC3:** czas testu SEC1 w `test-results/vitest-junit.xml`: 0,197 s (wcześniej ~2,3 s); bez `performance.now()`.
- **AC4:** `pnpm test` → 151 plików, 1184 testy zielone; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm quality` bez błędów.

## Prevention

Linia w `testing-strategy.md:41` (bez stałej pauzy przed asercją) już jest — dodana przy przeglądzie E-02.

Co by zapobiegło: reguła, która pada automatycznie. Propozycja dla użytkownika: ESLint `no-restricted-syntax` / `no-restricted-imports` w `apps/api/test/**` zabraniające `new Promise((r) => setTimeout(r, n))` i importu `pause` z `./live` — wymaga najpierw migracji pozostałych wystąpień (lista w „Root cause”), bo `eslint.directives.config.js` blokuje wyłączenia inline.

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-04)

Verdict: pass

Scope: commit `5046936` (tylko `apps/api/test/`: `gated-pool.ts`, `mailer.ts`, `live.session.test.ts`, `password-reset.test.ts`, `password-reset-rate-limit.test.ts`).

Reproduce:
- `pnpm vitest run --project api live.session password-reset` — 8 plików, 40 testów zielone.
- `pnpm vitest run --project api --sequence.shuffle` — 108 plików, 474 testy zielone (AC4).
- `pnpm typecheck`, `pnpm lint` (oba configi), `pnpm format:check` — bez błędów.

Acceptance criteria:
- AC1 pass — w `live.session.test.ts` brak `pause`; asercja `queries()` po odebranym pingu (`onPing` wołany synchronicznie po `connection.send(ping)` w `ws-connection.ts:34-35`, więc odbiór pingu to poprawny sygnał), po `release()` `vi.waitFor` na `answered()`. Stres: 10× `--sequence.shuffle --pool threads --maxWorkers 8` → 10/10; 5× przy 8 procesach obciążających CPU → 5/5.
- AC2 pass — „mail nie wyszedł” sprawdzane na `requested` zaraz po odpowiedzi. Założenie (wysyłka startuje przed odpowiedzią) potwierdzone w kodzie (`auth.ts:98-101` woła `onPasswordResetToken` synchronicznie, `konta/index.ts:133` woła `mailer.send` synchronicznie) i przypięte testem SEC1.
- AC3 pass — SEC1 bez `performance.now()`, 0,247 s w `vitest-junit.xml`.
- AC4 pass — patrz wyżej.

Spot-checks (wszystkie cofnięte, `git status` czysty):
1. Usunięte `if (checking) return;` w `sessionCheck` → `live.session.test.ts` AC2 FAIL `expected 4 to be 2`.
2. `mailer.send` opóźniony `setTimeout(100)` w `sendResetMail` → SEC1 FAIL `expected [] to deeply equal [ Array(1) ]`.
3. Serwer czeka na mail (`sendResetPassword` zwraca obietnicę wysyłki) → SEC1 FAIL (timeout 30 s, bo `hold` nie jest zwolniony).

Fix task: sekcja Root cause wyjaśnia, czemu testy nie łapały (zielone i przy poprawnym kodzie, i przy regresji po pauzie); red evidence obecne.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | Testy | Regresja „odpowiedź czeka na mail” w SEC1 objawia się dopiero 30-sekundowym timeoutem testu, nie czytelną asercją. | Spot-check 3: `Error: Test timed out in 30000ms.` | Np. `Promise.race` odpowiedzi z krótkim limitem i komunikatem „odpowiedź czeka na mail” — opcjonalne. |
| 2 | note | Testy | `gatedPool.answered()` nie liczy zapytań zakończonych błędem (rejection omija `delivered += 1`). Dziś bez znaczenia, ale nazwa sugeruje „oddane wywołującemu”. | `gated-pool.ts:38-48` | Doprecyzować JSDoc albo liczyć też odrzucone. |
| 3 | note | Testy | Pozostałe stałe pauzy w innych testach (lista w Root cause) i reguła ESLint z Prevention — do osobnego zadania. | Root cause, Prevention | Decyzja użytkownika. |
