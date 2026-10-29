---
id: T-021
title: "Stabilne i szybsze testy: limity czasu web i pula testowa API"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change   # bug | small-change
severity: normal     # incident | high | normal | low
status: in-qa           # todo | in-progress | in-qa | done | blocked
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
