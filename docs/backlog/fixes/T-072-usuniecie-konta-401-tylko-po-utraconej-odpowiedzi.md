---
id: T-072
title: "SC-09: 401 przy usuwaniu konta to sukces tylko po utraconej odpowiedzi"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: in-qa                 # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-04]
threats: []
screens: [SC-09, SC-01]
related_tasks: [T-062]
---

# T-072 SC-09: 401 przy usuwaniu konta to sukces tylko po utraconej odpowiedzi

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, S2 (major); spójność C8.

- **Actual:** `useDeleteAccount` liczy próby w `useRef` i nigdy nie zeruje licznika (`apps/web/src/screens/SC-09-konto/useDeleteAccount.ts:15-23`). Po każdej wcześniejszej porażce (np. 500) traktuje 401 jako „konto usunięte”. Jeśli sesja wygasła w innej karcie, użytkownik widzi na SC-01 „Konto zostało usunięte.”, choć konto istnieje.
- **Expected:** „Konto zostało usunięte.” pojawia się tylko wtedy, gdy konto naprawdę usunięto. 401 może oznaczać sukces tylko po próbie, której odpowiedź się zgubiła (błąd sieci). Każde inne 401 to zwykły koniec sesji (`RequireSession`). Źródło: komentarz w samym hooku i `T-062-usuniecie-konta.md` AC4.
- **Steps to reproduce:**
  1. Na SC-09 kliknij „Usuń konto”; API odpowiada 500 (MSW).
  2. Wyloguj się w innej karcie (sesja traci ważność) i ponów usunięcie: API odpowiada 401.
  3. SC-01 pokazuje „Konto zostało usunięte.”.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 7c3435f.

## Acceptance criteria

- [ ] AC1: Given pierwsza próba zakończona 500, when druga próba dostaje 401, then klient kończy sesję jak przy zwykłym 401, bez komunikatu „Konto zostało usunięte.”. — verified by: test ekranu (MSW)
- [ ] AC2: Given pierwsza próba zakończona błędem sieci (odpowiedź utracona), when ponowienie dostaje 401, then pojawia się „Konto zostało usunięte.” (zachowanie z T-062). — verified by: test (MSW)
- [ ] AC3: Given zamknięcie i ponowne otwarcie okna potwierdzenia, then stan prób zaczyna się od nowa. — verified by: test
- [ ] AC4: No regression in: E2E usunięcia konta (T-062).

## TDD plan

**Seam:** ekran SC-09 z MSW.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | 500, potem 401: brak komunikatu o usunięciu | component | Vitest + RTL + MSW | AC1 |
| 2 | błąd sieci, potem 401: komunikat o usunięciu | component | Vitest + RTL + MSW | AC2 |
| 3 | ponowne otwarcie okna zeruje stan | component | Vitest + RTL | AC3 |

**Run:** `pnpm vitest run --project web SC-09`

## QA plan

- **Regression:** T-062 (wszystkie AC), wylogowanie w innej karcie.
- **Edge cases:** 429 przed 401, dwa szybkie kliknięcia.
- **Platforms:** web.

## Root cause

`useDeleteAccount` (T-062) odróżniał „ponowienie po utraconej odpowiedzi” od zwykłego 401 licznikiem prób w `useRef`, który rósł przy każdej próbie i nigdy się nie zerował. Warunek `attempts > 1` mierzył więc „była jakaś wcześniejsza próba”, a nie „wcześniejsza próba straciła odpowiedź”. 401 po 500 albo po zamknięciu i ponownym otwarciu okna dawał „Konto zostało usunięte.”.

**Dlaczego testy tego nie złapały:** T-062 testował tylko dwa przypadki (błąd sieci → 401 i 401 przy pierwszej próbie), bez 401 po zwykłej porażce. Do tego test „first attempt gets 401” sprawdzał brak komunikatu (`queryByText(...).toBeNull()`) zaraz po zmianie ścieżki. Od T-071 `InlineAlert` dostaje tekst sukcesu dopiero po `SUCCESS_ANNOUNCE_DELAY_MS` (100 ms), więc taki test przechodzi niezależnie od zachowania. Pierwsza wersja testów T-072 z tą samą asercją też była zielona przy błędnym kodzie.

**Fix:** flaga `lostResponse` ustawiana tylko przy błędzie `network` i trwała w obrębie jednego okna potwierdzenia (sieć → 429 → 401 nadal liczy się jako usunięcie, bo utracona próba mogła konto usunąć). `reset` hooka (wywoływany przy otwarciu okna) ją zeruje. Testy sprawdzają stan wejścia SC-01 (`{ from: "/konto" }` od `RequireSession`), a nie brak tekstu.

**Ten sam wzorzec gdzie indziej:** brak innych liczników prób. `useLeaveList` i `useRemoveParticipant` traktują `not_found` jako sukces bezwarunkowo: to idempotentne „już nie ma”, nie ta sama przyczyna (przegląd C8 proponuje wspólny helper, zob. Prevention).

## Evidence

- Reproducing tests (`AccountScreen.delete.test.tsx`): „ends the session without the deletion message when 401 follows a server failure” (AC1) i „forgets a lost response after the dialog is closed and opened again” (AC3). Przed poprawką: `AssertionError: expected { accountDeleted: true } to deeply equal { from: '/konto' }`. AC2: istniejący test „goes to SC-01 with „Konto zostało usunięte.” when the retry of a lost response gets 401”.
- Wzmocniony test „ends the session without the deletion message when the first attempt gets 401”: wspólna asercja `signInShownWithoutDeletion` (stan wejścia zamiast braku tekstu).
- Po poprawce: `pnpm vitest run --project web --project shared --project tokens` 708/708, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` OK. Projekt `api` i E2E nie wystartowały lokalnie (Docker nie działa: brak bazy); zmiana dotyczy tylko `apps/web`.

## Prevention

Przegląd C8: jedna decyzja „już zrobione przy ponowieniu” dla wszystkich mutacji usuwających (wspólny helper w `api/`).

## Incident note

<!-- QA rounds are appended below by /qa-task -->
