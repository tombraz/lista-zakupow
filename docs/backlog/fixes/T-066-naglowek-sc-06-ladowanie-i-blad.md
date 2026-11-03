---
id: T-066
title: "SC-06: pusty nagłówek h1 podczas ładowania i przy błędzie"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-06, N-04]
threats: []
screens: [SC-06]
related_tasks: [T-014, T-022]
---

# T-066 SC-06: pusty nagłówek h1 podczas ładowania i przy błędzie

## Report

Źródło: UAT E-01 (`docs/backlog/E-01-szkielet-i-wspolna-lista/UAT.md`, „Znane ograniczenia”), zaplanowane przez `/plan-backlog` 2026-11-01 na prośbę właściciela.

- **Actual:** `ListScreen` przekazuje do `AppBar` `title={list?.name ?? ""}`, więc w stanach Loading i Error — wczytanie `h1` jest pusty, a `<title>` strony to „ · Wspólna lista zakupów”. Czytnik ekranu nie ma nazwy strony; `useRouteFocus` nie ustawia fokusu, dopóki tytuł jest pusty.
- **Expected:** `h1` zawsze ma tekst (WCAG 2.4.2, 2.4.6, 1.3.1): podczas ładowania i przy błędzie „Lista” (propozycja copy zatwierdzona przez właściciela 2026-11-01), po wczytaniu nazwa listy.
- **Steps to reproduce:** otwórz `/listy/<id>` z wolną siecią (DevTools „Slow 3G”) albo z API zwracającym 500.
- **Environment:** web, `main` @ `c3dbc86`.

## Acceptance criteria

- [ ] AC1: Given SC-06 w stanie Loading, then `h1` „Lista” i tytuł karty „Lista · Wspólna lista zakupów”; po wczytaniu `h1` = nazwa listy, a fokus po wejściu ląduje na `h1` dokładnie raz (bez podwójnego ogłoszenia, T-014, T-022). — verified by: test komponentu (MSW z opóźnieniem)
- [ ] AC2: Given Error — wczytanie, then `h1` „Lista”, komunikat „Nie udało się wczytać listy.” + „Spróbuj ponownie”. — verified by: test komponentu
- [ ] AC3: Given SC-06 w stanach Loading i Error, when E2E je odwiedza, then axe bez naruszeń (`page-has-heading-one`, `empty-heading`). — verified by: E2E Playwright + axe
- [ ] AC4: No regression in: fokus na nagłówku po zmianie trasy (T-014) i po wejściu linkiem (T-022), stan „No permission”, zmiana nazwy listy na żywo.

## TDD plan

**Seam:** ekran SC-06 z MSW; przeglądarka (Playwright)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Loading: `h1` „Lista”, potem nazwa listy, fokus raz | component | Vitest + RTL + MSW | AC1 |
| 2 | Error: `h1` „Lista” | component | Vitest + RTL + MSW | AC2 |
| 3 | axe w stanach Loading i Error | E2E | Playwright + axe | AC3 |

**Run:** komendy „wszystkie testy warstwy” z przewodnika web oraz E2E web

## QA plan

- **Regression:** wejście na SC-06 z SC-05, z linku zaproszenia, odświeżenie strony; czytnik ekranu (VoiceOver / NVDA) — co jest ogłaszane przy wejściu i po wczytaniu.
- **Edge cases:** bardzo wolne wczytanie, ponowienie po błędzie.
- **Platforms:** Safari iOS, Chrome Android, komputer.

## Root cause

<Do uzupełnienia przez implementującego.>
