---
id: T-021
title: "Stabilne i szybsze testy: limity czasu web i pula testowa API"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change   # bug | small-change
severity: normal     # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
depends_on: [T-019, T-020]
layers: [web, backend]
requirements: []
threats: []
screens: []
related_tasks: [T-001, T-005, T-006, T-010]
---

# T-021 Stabilne i szybsze testy: limity czasu web i pula testowa API

## Report

- **Actual:** Testy web są niestabilne pod obciążeniem (dwa równoległe przebiegi: 7 i 5 czerwonych), a `asyncUtilTimeout: 3000` (`apps/web/test/setup.ts:9`) to maskuje; przebieg web ok. 60 s (budżet < 1 min), test limitu 500 (`ListScreen.add.test.tsx:187-195`) 2,6–6 s. Harness API używa produkcyjnej puli z `connectionTimeoutMillis` 3 s (`apps/api/test/database.ts:24` → `apps/api/src/db/pool.ts`): „Connection terminated due to connection timeout”; przebieg 196 s (budżet < 2 min), pliki do 7,6 s (budżet < 5 s).
- **Expected:** Zestawy mieszczą się w budżetach `docs/architecture/testing-strategy.md:12-13` i przechodzą pod obciążeniem bez podnoszenia limitów — source: `testing-strategy.md`
- **Steps to reproduce:**
  1. Dwa równoległe `pnpm vitest run --project web`.
  2. `pnpm vitest run --project api --project shared` z czasami.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #C3, #C4.

## Acceptance criteria

- [ ] AC1: Given pełny przebieg web, when uruchomiony dwa razy równolegle, then 0 czerwonych; jeden przebieg < 60 s. — verified by: pomiar w Evidence
- [ ] AC2: Given testy API, when pełny przebieg, then brak „Connection terminated”, całość < 2 min, pliki < 5 s albo wyjątek zapisany w `testing-strategy.md`. — verified by: pomiar w Evidence
- [ ] AC3: No regression in: `pnpm check`, CI (Linux, równolegle) i Windows.

## TDD plan

**Seam:** konfiguracja Vitest, `renderApp` / `test/setup.ts`, `apps/api/test/database.ts` i `global-setup.ts`. Zadanie dotyczy samych testów, więc „test odtwarzający” to pomiar przebiegu pod obciążeniem (zgodnie z AC).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Dwa równoległe `pnpm vitest run --project web` (odtwarza błąd: 6 + 6 czerwonych) | komponent (cały zestaw) | Vitest + RTL + MSW | AC1 |
| 2 | `SC-07 invitations of the owner > creates a link once while saving and shows it on top with focus on Kopiuj (AC1)` pod obciążeniem (odtwarza: `expected 2 to be 1`) | komponent | Vitest + RTL + MSW | AC1 |
| 3 | `pnpm vitest run --project web` — czas przebiegu i najwolniejsze testy (reporter JSON) | komponent (cały zestaw) | Vitest | AC1 |
| 4 | `pnpm vitest run --project api --project shared` — czas, „Connection terminated” (odtwarza: 204 s) | integracja (cały zestaw) | Vitest + Testcontainers | AC2 |
| 5 | `pnpm vitest run --project api --maxWorkers=1` — czas każdego pliku | integracja | Vitest + Testcontainers | AC2 |
| 6 | `integration database harness > starts the next test with empty tables` (istniejący) | integracja | Vitest + Testcontainers | AC2 (czyszczenie `DELETE`) |

**Run:** `pnpm vitest run --project web` (dwa naraz); `pnpm vitest run --project api --project shared`; `pnpm vitest run --project api --maxWorkers=1`

## QA plan

- **Regression:** `pnpm check`, CI (Linux, równolegle) i Windows
- **Edge cases:** odpowiedź `heldResponse()` niezwolniona do końca testu (handler MSW wisi jak `delay("infinite")`, `cleanup` i `resetHandlers` w `afterEach`); w SC-08 „Sprawdzamy zaproszenie…” fokus sprawdzany przed zwolnieniem odpowiedzi (po nim `h1` jest renderowany na nowo); `warmUp()` w `beforeAll` każdego pliku web — błąd rozgrzewki wywraca cały plik (limit haka 10 s, `findBy` rozgrzewki 8 s); `isolate: false` w `api`: kolejność plików w workerze dowolna — `vi.useFakeTimers` zawsze z `useRealTimers` w `afterEach`, brak stanu modułów w `apps/api/src`; `DELETE` z `session_replication_role = replica` (użytkownik testowy jest superuserem kontenera) — schemat bez sekwencji, nowa tabela z sekwencją wymaga restartu (zapisane w `layers/db.md`); test limitu 500 w SC-06 liczy 499 kupionych (zwinięte, nierenderowane) + 1 do kupienia — limit liczy wszystkie pozycje (`useAddItem`); pula testowa 20 s nie dotyczy testów, które same tworzą pulę (`migrate-slow-database`, `config`).
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

Web: testy zakładały okna czasowe — stan „w trakcie” trzymało `delay(100–200 ms)` w MSW, a pierwszy test pliku płacił zimny start workera — i zużywały dużo CPU (pisanie formularzy wejścia znak po znaku: ~60 przerysowań na test; 500 renderowanych wierszy w teście limitu). Przy dwóch przebiegach naraz okna się zamykały (SC-07: odpowiedź przed drugim kliknięciem → dwa `POST`), testy przekraczały 5 s, a pierwszy `findBy` 1 s; QA T-005 (runda 2) podniosło wtedy `asyncUtilTimeout` do 3 s zamiast usunąć przyczynę. Wyścigi w kodzie aplikacji (C1, C2) usunęły T-019 i T-020. API: jeden kontener PostgreSQL z `fsync` dla wszystkich workerów, `TRUNCATE` przed każdym testem (~0,4 s, pod obciążeniem do 2,8 s), ponowny import Fastify i Better Auth w każdym pliku (~połowa czasu przebiegu) i produkcyjny limit połączenia 3 s w puli testowej.

Dlaczego testy tego nie złapały: cele szybkości z `testing-strategy.md` nie są niczym mierzone, a na nieobciążonej maszynie wszystko przechodzi; nikt nie uruchamiał zestawu pod obciążeniem.

Inne wystąpienia (ta sama przyczyna, poprawione tutaj): `delay(ms)` jako okno „w trakcie” w `routeFocus`, SC-05, SC-06 (ładowanie, dodawanie, odhaczanie, „Usuń kupione”), SC-08; pętla `createList` w `lists.limit.test.ts`. Bez zmian: `delay(100)` w `ListScreen.live.test.tsx` (porządkuje zdarzenie WS przed odpowiedzią, nie okno na kroki testu) i `delay(50)` w SC-07 (kliknięcia synchroniczne `fireEvent`).

Środowisko lokalne (poza repozytorium): w Dockerze działało 78 osieroconych kontenerów PostgreSQL z przerwanych przebiegów; `ryuk` ich nie usuwa, bo połączenie trzyma wiszący serwer E2E (`apps/web/e2e/server.ts`) z 2026-10-27. Bezczynne (~2,8 GB RAM), nie są główną przyczyną.

## Evidence

Pomiary lokalnie, Windows 11, 8 rdzeni, Docker Desktop; gałąź `epic/E-01-szkielet-i-wspolna-lista` po T-019 i T-020.

**Przed (odtworzenie):**
- Dwa równoległe przebiegi web: 6 + 6 czerwonych. Przekroczony limit 5 s: SC-02 (3 testy), SC-08 → SC-01/SC-02 (2); SC-07 AC1 `expected 2 to be 1` (`ParticipantsScreen.test.tsx:101`); `SC-01 → Załóż konto…` z e-mailem `ka-123tome` — `user.type` testu przerwanego limitem pisał dalej do DOM następnego testu.
- Jeden przebieg web: 43–46 s; suma czasów testów 129 s; 38 testów > 1 s; najwolniejszy 3,8 s; limit 500: 2,3–3 s. Profil: render Reacta ~45%, `user.type` ~30% czasu testów formularzy; `pool: vmThreads` odpada (MSW: `WritableStream is not defined`).
- API (`--project api --project shared`): 204 s, 29/65 plików > 5 s (w przeglądzie: 196 s i „Connection terminated due to connection timeout”). Haki: `TRUNCATE` śr. 413 ms (maks. 2,8 s, 199×), `CREATE DATABASE` 689 ms, `DROP` 423 ms; rejestracja w fabryce śr. 313 ms (scrypt ~137 ms), 31% czasu testów.

**Po zmianach (kolejno, API):** kontener bez `fsync` 141 s → `DELETE` zamiast `TRUNCATE` (śr. 139 ms) 121 s → `isolate: false` 94 s → lista 50 list jednym `INSERT` 85 s. Odrzucone: `STRATEGY FILE_COPY` (w granicach szumu); `maxWorkers` per projekt (Vitest wymaga wtedy osobnej `sequence.groupOrder`, czyli api i web szłyby po kolei).

**Po:**
- AC1: dwa równoległe przebiegi web, dwie rundy: 4 × 183/183 (66–70 s każdy przy obciążeniu). Jeden przebieg: 40,5 s i 43,3 s, suma testów 77–89 s, najwolniejszy 1,9 s, limit 500: ~0,75 s. Domyślny `asyncUtilTimeout` (1 s), domyślny limit testu (5 s).
- AC2: pełny przebieg API 85 s (65 plików, 0 czerwonych, 0 „Connection terminated”). Przy jednym workerze > 5 s tylko 4 pliki — wyjątki w `testing-strategy.md` (sign-in-rate-limit ~13 s, sign-up ~8 s, items.limit ~7 s, lists.limit ~7 s).

## Prevention

<Uzupełnia /fix; propozycje w `docs/reviews/E-01-2026-10-29-1.md`, sekcja „Proposals”.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-29)

Verdict: pass

Niezależna weryfikacja (Windows 11, Docker Desktop, gałąź `epic/E-01-szkielet-i-wspolna-lista`, commit `4e0a660`).

**Kryteria akceptacji**

- **AC1 — pass.** Jeden przebieg `pnpm vitest run --project web`: 183/183, 46,8 s (< 60 s). Dwa przebiegi równolegle: 183/183 + 183/183 (77,8 s i 76,8 s). Obciążenie większe niż w AC: dwa przebiegi web + przebieg API naraz — 183/183, 183/183, API 204/204, 0 „Connection terminated”. `setup.ts` bez `configure({ asyncUtilTimeout })`, `vitest.config.ts` web bez `testTimeout` — limity domyślne.
- **AC2 — pass.** `pnpm vitest run --project api --project shared`: 65 plików, 234/234, 63,6 s (< 2 min), 0 „Connection terminated”. `--project api --maxWorkers=1` (reporter JSON): jedyny plik > 5 s to `sign-in-rate-limit.test.ts` (8,3 s), wpisany jako wyjątek w `testing-strategy.md`.
- **AC3 — pass (lokalnie); CI Linux nieweryfikowalne.** `pnpm check` na Windows: exit 0 (format, lint, typecheck, quality, design-check, backlog-check, workflow-check, 89 plików / 419 testów Vitest, mobile 10/10). Dla commitu `77e800e` nie ma jeszcze przebiegu CI (gałąź niewypchnięta; QA nie wypycha) — CI pull requesta to sprawdzi.

**Spot-checki (przywrócone, `git status` czysty)**

- Wyłączona blokada w `useGuardedMutation.ts` (`if (locked.current.has(lock)) return;`): testy SC-07 T-020 czerwone (`expected 2 to be 1`, `expected [ 'a', 'a', 'b' ]`) — przepisane testy nadal gryzą.
- `heldResponse()` zwalniane od razu (`resolve()` w konstruktorze): 6 czerwonych testów stanu „w trakcie” (routeFocus, SC-06 dodawanie / odhaczanie / „Usuń kupione”, SC-07 AC1, SC-08 „Sprawdzamy zaproszenie…”) — wstrzymanie odpowiedzi jest tym, co te testy sprawdzają, a nie przypadkiem czasu.

**Przegląd kodu:** zmiany tylko w testach, konfiguracji testów i dokumentacji; kod produkcyjny nietknięty. `DELETE` z `session_replication_role = replica` w transakcji (`SET LOCAL`) — schemat bez sekwencji (wszystkie snapshoty drizzle: `"sequences": {}`), więc brak `RESTART IDENTITY` nic nie zmienia. `isolate: false` w api: fałszywe zegary zawsze z `useRealTimers` w `afterEach`, brak modułowego stanu mutowalnego w `apps/api/src`. Limit 500 w SC-06 nadal sprawdzany (499 kupionych + 1, limit liczy wszystkie pozycje). Sekcja „Root cause” wyjaśnia, dlaczego testy tego nie łapały (cele szybkości niemierzone, brak przebiegu pod obciążeniem).

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | dokumentacja | Tabela wyjątków „plik < 5 s” w `testing-strategy.md` jest nieaktualna: przy jednym workerze `sign-up` 2,2 s, `lists.limit` 2,5 s, `items.limit` 1,5 s, `sign-in-rate-limit` 8,3 s (w tabeli ~8, ~7, ~7, ~13 s). | JSON reporter `--project api --maxWorkers=1` | W tabeli tylko pliki faktycznie > 5 s, czasy z pomiaru. |
| 2 | minor | testy web | Gdy test padnie przed `response.release()`, handler MSW wisi do końca przebiegu (obietnica nigdy nie rozwiązana). Nie psuje kolejnych testów (`cleanup`, `resetHandlers`), ale `afterEach` mógłby zwalniać wszystkie wstrzymane odpowiedzi. | `apps/web/test/held.ts` | Opcjonalnie: rejestr wstrzymanych odpowiedzi zwalniany w `afterEach`. |
| 3 | note | proces | Sekcja „Prevention” to wciąż szablon („Uzupełnia /fix…”). Cele szybkości dalej nie są mierzone automatycznie. | task file | Uzupełnić; np. krok CI z limitem czasu przebiegu (`timeout-minutes`) albo raport JSON z progiem. |
| 4 | note | środowisko | Lokalnie nadal 82 kontenery `postgres:17.11-alpine` z przerwanych przebiegów (poza repozytorium, opisane w Root cause). | `docker ps` | Posprzątać ręcznie; ewentualnie zadanie na zamykanie serwera E2E. |
| 5 | note | CI | AC3 „CI (Linux, równolegle)” nieweryfikowalne lokalnie — brak przebiegu CI dla `77e800e`. | `gh run list --commit 77e800e…` pusty | Sprawdzić zielony CI po wypchnięciu. |
