---
id: T-011
title: "SC-06 Empty: fokus w polu dodawania po otwarciu pustej listy"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa          # todo | in-progress | in-qa | done | blocked
depends_on: [T-006]
layers: [web]          # names from docs/architecture/layers/
requirements: [F-07]   # F-xx the expected behaviour comes from
threats: []            # TH-xx from docs/architecture/threat-model.md this task mitigates
screens: [SC-06]
related_tasks: [T-005, T-006]
---

# T-011 SC-06 Empty: fokus w polu dodawania po otwarciu pustej listy

## Report

- **Actual:** po otwarciu listy bez pozycji fokus jest na `<body>`.
- **Expected:** fokus w polu „Co kupić?” — source: SC-06 „States” → Empty: „Lista jest pusta. Dopisz pierwszą rzecz w polu na dole.”; fokus na polu dodawania.
- **Steps to reproduce:**
  1. Zaloguj się, utwórz nową listę.
  2. Otwórz ją (`/listy/<id>`).
  3. `document.activeElement` = `<body>`.
- **Environment:** lokalnie, web, wszystkie przeglądarki; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `5c36ec0`).
- **Evidence:** QA T-006 runda 1 #4 i runda 2 #1 (scenariusz X0: `document.activeElement` = `<body>`). Pilność normalna, nie dotyczy bezpieczeństwa.

## Acceptance criteria

- [x] AC1: Given lista bez pozycji, when domownik otworzy SC-06 i lista się wczyta, then fokus jest w polu „Co kupić?”. — verified by: test komponentu „focuses the add field when an empty list opens”
- [x] AC2: No regression in: J-03 (dodanie, fokus po dodaniu, arkusz, fokus po usunięciu), J-02 (SC-06 lista, menu właściciela), stan Loading (AddBar nieaktywny do wczytania).

## TDD plan

**Seam:** ekran SC-06 z API podstawionym przez MSW

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | pusta lista po wczytaniu → fokus w „Co kupić?” | component | Vitest + RTL + MSW | AC1 |

**Run:** `pnpm --filter @lista/web exec vitest run src/screens/SC-06-lista`

## QA plan

- **Regression:** J-03 (fokus po dodaniu zostaje w polu, po usunięciu na następnej pozycji / w polu, arkusz zwraca fokus), J-02, Loading (pole nieaktywne, potem fokus po wczytaniu), lista z pozycjami.
- **Edge cases:** wolne wczytanie (throttling) — fokus dopiero po wczytaniu; błąd wczytania i „Spróbuj ponownie”; lista z pozycjami (spec nie wymaga fokusu w polu); usunięcie ostatniej pozycji.
- **Platforms:** Chrome / Firefox na komputerze, telefon 390 px (klawiatura ekranowa przy fokusie programowym), czytnik ekranu (ogłasza pole).

## Root cause

Przy wejściu na SC-06 nikt nie ustawia fokusu: `Items` przenosi go do „Co kupić?” tylko po usunięciu ostatniej pozycji (`useFocusAfterRemoval`, T-006), a `ListScreen` nie ma fokusu startowego. Reguła fokusu dla stanu Empty stoi w tabeli „States” SC-06, a T-006 przeniósł do kryteriów (AC1, AC7, AC9) tylko zachowania fokusu z sekcji „Accessibility”, więc żaden test nie sprawdzał fokusu przy wejściu (E2E J-03 zaczyna od pustej listy, ale sprawdza tylko tekst i axe).

Inne wystąpienia: brak — reguła „fokus przy wejściu w stanie Empty” jest tylko w SC-06 (`grep` po `docs/design/screens/`).

## Evidence

Przebieg 2026-10-28, Windows 11, Docker (Testcontainers `postgres:17.11-alpine`).

- **Red** — `ListScreen.add.test.tsx` „SC-06 AddBar › focuses the add field when an empty list opens (SC-06 Empty, T-011)”: `expect(element).toHaveFocus()` — `Expected element with focus: <input class="input" …>`, `Received element with focus: <body>`.
- **Poprawka** — `Items.tsx`: przy montowaniu, gdy lista wczytała się pusta (`useRef` z wartością początkową), fokus w `addNameRef`. Tylko przy wejściu: późniejsze opróżnienie listy przez inną osobę nie przenosi fokusu (SC-06 „Accessibility”). AddBar jest już aktywny w tym samym renderze (`disabled={!list.data}`), więc fokus trafia w aktywne pole.
- **Green** — testy SC-06: 4 pliki / 45 testów; `pnpm check` (Prettier, ESLint, `tsc`, jscpd 0 klonów, dependency-cruiser 0 naruszeń, design-check 0 błędów, backlog-check OK, Vitest **49 plików / 245 testów**); `pnpm build` OK; `pnpm test:e2e` **22/22** (J-02, J-03 bez regresji).

## Prevention

<filled in Step 8>

<!-- QA rounds are appended below by /qa-task -->
