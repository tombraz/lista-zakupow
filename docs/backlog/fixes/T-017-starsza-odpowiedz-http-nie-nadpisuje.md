---
id: T-017
title: "Spóźniona odpowiedź HTTP nie nadpisuje nowszej zmiany z WebSocket; jeden zegar updatedAt"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web, backend]
requirements: [F-14]
threats: []
screens: [SC-06]
related_tasks: [T-006, T-007, T-009]
---

# T-017 Spóźniona odpowiedź HTTP nie nadpisuje nowszej zmiany z WebSocket; jeden zegar updatedAt

## Report

- **Actual:** `replaceItem` (`apps/web/src/screens/SC-06-lista/itemsCache.ts:33-36`, wołane z `useEditItem.ts`, `useCheckItem.ts`) bezwarunkowo podmienia pozycję odpowiedzią HTTP. Gdy zdarzenie WS ze zmianą osoby B dotrze przed spóźnioną odpowiedzią na zmianę A, autor A widzi swoją wersję, choć w bazie jest B. Do tego `updatedAt` pozycji ustawiają dwa zegary: edycja `now()` bazy (`apps/api/src/modules/pozycje/infra/items-repository.ts:85`), odhaczenie `Clock` aplikacji (`:129-130`).
- **Expected:** Cache klienta przyjmuje wersję pozycji tylko, gdy jej `updatedAt` jest nowsze niż posiadana (dla HTTP i WS); `updatedAt` pozycji zawsze z wstrzykiwanego `Clock` — source: T-009 AC4, `docs/architecture/api.md:95`, `layers/db.md` „Konwencje”
- **Steps to reproduce:**
  1. Test komponentu: edycja A z opóźnioną odpowiedzią MSW; w międzyczasie zdarzenie WS `item.updated` z nowszym `updatedAt` (B).
  2. Po odpowiedzi A cache pokazuje A.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #P1, #S6, #P3.

## Acceptance criteria

- [ ] AC1: Given zdarzenie WS z nowszym `updatedAt` przed odpowiedzią HTTP własnej zmiany, when przyjdzie odpowiedź, then SC-06 pokazuje nowszą wersję. — verified by: test komponentu SC-06 (podstawiony klient WS)
- [ ] AC2: Given `testClock` w API, when edycja pozycji, then `updatedAt` = czas z zegara (jak przy odhaczeniu). — verified by: test integracyjny API
- [ ] AC3: No regression in: J-05 (zmiany na żywo), własna zmiana bez podświetlenia, edycja i odhaczenie tej samej pozycji przez dwie osoby.

## TDD plan

**Seam:** cache SC-06 (`replaceItem` / `upsertNewer`); repozytorium pozycji

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | <odtwarza błąd — uzupełnia /fix> | | | AC1 |

**Run:** `pnpm --filter @lista/web test`; `pnpm --filter @lista/api test`

## QA plan

- **Regression:** J-05 (zmiany na żywo), własna zmiana bez podświetlenia, edycja i odhaczenie tej samej pozycji przez dwie osoby
- **Edge cases:** <uzupełnia /fix>
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

<Uzupełnia /fix.>

## Evidence

<Uzupełnia /fix.>

## Prevention

<Uzupełnia /fix; propozycje w `docs/reviews/E-01-2026-10-29-1.md`, sekcja „Proposals”.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->
