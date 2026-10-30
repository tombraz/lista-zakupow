---
id: T-039
title: "Fokus spada na body po szybkim odhaczeniu dwóch sąsiednich pozycji"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-08]
threats: []
screens: [SC-06]
related_tasks: [T-007, T-030]
---

# T-039 Fokus spada na body po szybkim odhaczeniu dwóch sąsiednich pozycji

## Report

Źródło: T-030, znalezisko poza zakresem, potwierdzone przez QA T-030 runda 1 (minor); przyjęte przez użytkownika jako osobne zadanie (2026-10-30). Luka istniała przed T-030.

- **Actual:** `useCheckItem` liczy cel fokusu (`neighbourOf`) w chwili kliknięcia. Gdy użytkownik odhaczy Chleb, a przed odpowiedzią API sąsiednie Mleko, celem dla Mleka jest Chleb, który po zapisie jest już w zwiniętym „Kupione”. `useCheckboxFocus` nie znajduje checkboxa i fokus zostaje na usuniętym przycisku Mleka (w przeglądarce spada na `body`) (`apps/web/src/screens/SC-06-lista/useCheckItem.ts`, `neighbourOf`; `useCheckboxFocus.ts`).
- **Expected:** po odhaczeniu fokus trafia na następną nieodhaczoną pozycję (przy ostatniej na poprzednią, bez nich na „Kupione (N)”), także gdy cel wyliczony w chwili kliknięcia został w międzyczasie odhaczony — source: SC-06 „Accessibility”, WCAG 2.4.3
- **Steps to reproduce:**
  1. Lista: Jajka, Chleb, Mleko (do kupienia), odpowiedzi `PATCH` wstrzymane (`heldResponse()`).
  2. Kliknąć „Odhacz Chleb”, potem „Odhacz Mleko”, zwolnić odpowiedzi.
  3. Fokus nie jest na żadnym checkboxie ani na „Kupione (2)”.
- **Environment:** lokalnie; gałąź `epic/E-01-szkielet-i-wspolna-lista` po T-030.
- **Evidence:** test „checks two different items in quick succession (T-030)” celowo nie sprawdza fokusu; przy asercji fokusu na „Odhacz Jajka” fokus jest na `h1`.

## Acceptance criteria

- [ ] AC1: Given dwie sąsiednie pozycje odhaczane szybko po sobie, when obie odpowiedzi przyjdą, then fokus jest na nieodhaczonej pozycji (Jajka) albo, gdy takiej nie ma, na „Kupione (N)”. — verified by: test komponentu SC-06
- [ ] AC2: No regression in: fokus po pojedynczym odhaczeniu (następna / poprzednia / „Kupione”), zdarzenie na żywo przed odpowiedzią API (F-14), T-007, T-030.

## TDD plan

**Seam:** ekran SC-06 (`renderApp`) z MSW i `heldResponse()`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `moves focus to a still unchecked item when two neighbours are checked quickly (T-039)` | komponent | Vitest + RTL + MSW | AC1 |

**Run:** `pnpm vitest run --project web ListScreen.check`

## QA plan

- **Regression:** J-03, fokus po odhaczeniu, ogłoszenia, `ListScreen.live` (pozycja przeniesiona na żywo przed odpowiedzią).
- **Edge cases:** odhaczenie wszystkich pozostałych pozycji szybko po sobie (cel: „Kupione (N)”); odhaczenie i odznaczenie naraz.
- **Platforms:** Chrome na komputerze, telefon (dotyk), czytnik ekranu.

## Root cause

`useCheckItem` (T-007, `97062f9`) wyliczał przy kliknięciu jeden cel fokusu — najbliższego nieodhaczonego sąsiada — a `useCheckboxFocus` po odpowiedzi szukał tylko jego checkboxa. Gdy sąsiad został w międzyczasie odhaczony (drugie szybkie kliknięcie, odpowiedzi w dowolnej kolejności), jego checkbox był już w zwiniętym „Kupione”, efekt nie znajdował elementu i fokus zostawał na usuniętym przycisku (`body`). Testy tego nie złapały: testy fokusu (T-007) sprawdzają tylko pojedyncze odhaczenie, a test dwóch odhaczeń (T-030) celowo pomijał fokus.

Poprawka: przy kliknięciu zapamiętana jest kolejność kandydatów (`CheckFocus` `{ unchecked: string[] }`: nieodhaczone po pozycji, potem przed nią od najbliższej — kolejność z chwili kliknięcia zostaje, bo zdarzenie na żywo może przenieść pozycję przed odpowiedzią, F-14). `useCheckboxFocus` wybiera przy fokusie pierwszego kandydata, który na ekranie jest nadal nieodhaczony; bez takiego — „Kupione (N)”. Wariant `"bought"` zastąpiony pustą listą kandydatów.

Inne wystąpienia: brak — `checkboxFocus.focus({ itemId })` po „Pokaż w Kupione” (AddItemBar) celuje w konkretną pozycję, nie w sąsiada; fokus po usunięciu pozycji (`Items.tsx`, `afterRemoving`) nie dotyczy zapisów równoległych.

## Evidence

- Czerwone przed poprawką (`pnpm vitest run --project web ListScreen.check`): `moves focus to a still unchecked item when two neighbours are checked quickly (T-039)` i `moves focus to „Kupione (3)” when all items are checked quickly (T-039)` — `expect(element).toHaveFocus()`, fokus na `h1` zamiast „Odhacz Jajka” / „Kupione (3)”; `Tests 2 failed | 11 passed`.
- Po poprawce: `ListScreen.check` 13/13; web + tokens 26 plików / 231 testy; `pnpm typecheck`, `pnpm lint`, `pnpm design-check` czyste; build web OK. E2E nie uruchamiane (zmiana w hookach SC-06, pokryta testami komponentu).

## Prevention

Co by zapobiegło: fokus po zapisie był celem wyliczonym w chwili akcji i niesprawdzanym wobec stanu ekranu przy fokusie; testy fokusu obejmowały tylko jeden zapis naraz, choć od T-030 różne pozycje zapisują się równolegle. Automatyczna reguła (lint, typ) nie wyrazi tego tanio.

- Przyjęte przez użytkownika (2026-10-30), zrobione: wpis w „Pułapki” `layers/web.md` — cel fokusu po zapisie, który może przyjść równolegle z innym zapisem, rozstrzygany przy fokusie wobec aktualnego stanu ekranu (lista kandydatów, potem stały element zastępczy); każdy fokus po zapisie z `lockOf` ma test dwóch zapisów naraz z `heldResponse()`, sprawdzający, gdzie trafił fokus.

## Incident note

## QA round 1 (2026-10-30)

Verdict: pass

Sprawdzone samodzielnie (świeży kontekst): `pnpm test` 92 pliki / 500 testów zielone; `pnpm vitest run --project web` 228/228; `pnpm typecheck`, `pnpm lint` czyste; `design-check --scan apps/web/src/screens/SC-06-lista` 0 wartości wpisanych na sztywno; E2E `j03` + `j05` (telefon i komputer) 16/16.

Kryteria:
- AC1 — **pass**. Testy `moves focus to a still unchecked item…` i `moves focus to „Kupione (3)”…` asertują fokus na „Odhacz Jajka” / „Kupione (3)” po zwolnieniu obu odpowiedzi. Spot-check: przywrócenie `useCheckItem.ts` i `useCheckboxFocus.ts` z `0bd7740~1` → oba testy czerwone (`Tests 2 failed | 11 passed`), po przywróceniu zielone, `git status` czysty. Dodatkowo tymczasowy test eksploracyjny (usunięty) z osobnym zwalnianiem odpowiedzi: kolejność Mleko→Chleb, Chleb→Mleko, ostatnia (Mleko) potem poprzednia (Chleb), trzy pozycje w mieszanej kolejności → za każdym razem fokus na „Odhacz Jajka” albo „Kupione (3)”; 4/4.
- AC2 — **pass**. Istniejące testy fokusu po pojedynczym odhaczeniu (następna / poprzednia / „Kupione”), `ListScreen.live`, testy T-007 i T-030 zielone; E2E J-03 i J-05 zielone.

Fix: czerwony dowód w „Evidence” obecny; „Root cause” wyjaśnia, czemu testy tego nie złapały (T-007 tylko pojedyncze odhaczenie, T-030 celowo bez fokusu).

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | proces | Sekcja „Prevention” pusta, choć szablon `fix.md` jej wymaga. | `## Prevention` bez treści | Co by zapobiegło (np. reguła: test fokusu przy każdym teście zapisów równoległych) i co przyjął użytkownik. |
| 2 | minor | nazewnictwo | `neighbourOf` zwraca teraz listę kandydatów, nie sąsiada; komentarz „bez nich sekcja Kupione” opisuje zachowanie `useCheckboxFocus`, nie tej funkcji. | `useCheckItem.ts`, `neighbourOf` | Nazwa zgodna z wynikiem, np. `focusCandidates`. |
| 3 | note | zachowanie | Kandydaci są zamrożeni w chwili kliknięcia: pozycja dodana na żywo (F-14) po kliknięciu nie jest kandydatem, więc gdy wszyscy kandydaci zostaną odhaczeni, fokus trafi na „Kupione (N)”, choć na liście jest nowa nieodhaczona pozycja. | analiza `neighbourOf` / `firstUnchecked` | Rzadki przypadek; do decyzji, czy wybierać też spośród aktualnych nieodhaczonych. |
| 4 | note | dostępność | Ręczne sprawdzenie czytnikiem ekranu i dotykiem na telefonie (QA plan) nie wykonane w trybie automatycznym; wyścig odpowiedzi trudny do odtworzenia ręcznie. Pokrycie: testy komponentu + E2E J-03/J-05. | — | Sprawdzić przy UAT E-01. |
