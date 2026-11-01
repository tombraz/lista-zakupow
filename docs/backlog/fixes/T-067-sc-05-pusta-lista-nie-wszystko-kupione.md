---
id: T-067
title: "SC-05: karta pustej listy pokazuje „Wszystko kupione”"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend, web]
requirements: [F-06]
threats: [TH-01]
screens: [SC-05]
related_tasks: [T-005, T-007]
---

# T-067 SC-05: karta pustej listy pokazuje „Wszystko kupione”

## Report

Źródło: UAT E-01 (`UAT.md`, „Znane ograniczenia”; QA T-007), zaplanowane przez `/plan-backlog` 2026-11-01 na prośbę właściciela.

- **Actual:** karta listy na SC-05 bierze tekst z `toBuyCount` (`apps/web/src/screens/SC-05-moje-listy/messages.ts`): przy 0 zawsze „Wszystko kupione”, także dla listy bez żadnej pozycji. `ListSummary` nie ma liczby wszystkich pozycji, więc klient nie odróżni pustej listy od w pełni kupionej. SC-06 już to rozróżnia.
- **Expected:** lista bez pozycji pokazuje „Lista jest pusta” (propozycja copy zatwierdzona przez właściciela 2026-11-01, dopisać jako `card.empty` w SC-05 Copy); lista z samymi odhaczonymi — „Wszystko kupione”.
- **Steps to reproduce:** utwórz nową listę, wróć na SC-05.
- **Environment:** web + API, `main` @ `c3dbc86`.

## Acceptance criteria

- [ ] AC1: Given `GET /api/v1/lists`, then każdy `ListSummary` ma `itemCount` (wszystkie pozycje) obok `toBuyCount`; ten sam kształt w odpowiedzi utworzenia i zmiany nazwy listy oraz po `lists.changed`. — verified by: test integracyjny + typ w `packages/shared`
- [ ] AC2: Given karta listy, then `itemCount = 0` → „Lista jest pusta”; `itemCount > 0`, `toBuyCount = 0` → „Wszystko kupione”; `toBuyCount > 0` → „{n} do kupienia”. — verified by: test komponentu SC-05
- [ ] AC3: Given druga osoba dodaje pierwszą pozycję albo usuwa ostatnią, when SC-05 jest otwarte, then tekst karty zmienia się w ≤ 5 s. — verified by: test komponentu (zdarzenie na żywo) lub E2E
- [ ] SEC1 (TH-01): Given domownik bez dostępu do listy, then `GET /api/v1/lists` nadal jej nie zawiera (liczniki liczone tylko dla list z dostępem). — verified by: istniejący `lists.overview` / `lists.authz` + przypadek z pustą listą
- [ ] AC4: SC-05 Copy w `docs/design/screens/SC-05-moje-listy.md` ma `card.empty`; `api.md` opisuje `itemCount`. — verified by: przegląd QA

## TDD plan

**Seam:** HTTP API `GET /api/v1/lists` (`fastify.inject`); ekran SC-05 z MSW

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `itemCount` w przeglądzie i odpowiedziach list | integration | Vitest + Testcontainers | AC1, SEC1 |
| 2 | trzy warianty tekstu karty | component | Vitest + RTL + MSW | AC2 |
| 3 | zmiana tekstu po zdarzeniu na żywo | component | Vitest + RTL + MSW | AC3 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web

## QA plan

- **Regression:** kolejność list na SC-05, liczniki po odhaczeniu i „Usuń wszystkie kupione”, karta listy udostępnionej („od {imię}”).
- **Edge cases:** lista z 500 pozycjami (koszt zapytania licznika), usunięcie ostatniej pozycji przez inną osobę.
- **Platforms:** telefon i komputer.

## Root cause

<Do uzupełnienia przez implementującego.>
