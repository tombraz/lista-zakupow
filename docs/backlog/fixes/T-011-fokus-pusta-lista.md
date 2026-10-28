---
id: T-011
title: "SC-06 Empty: fokus w polu dodawania po otwarciu pustej listy"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
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

**Co by zapobiegło:** kryteria T-006 objęły zasady fokusu z sekcji „Accessibility” SC-06, ale nie zachowania zapisane w tabeli „States” (tam był fokus stanu Empty). Plan nie wymagał, żeby każdy dotknięty wiersz „States” miał kryterium i test.

Propozycje dla użytkownika (2026-10-28: przyjęte wszystkie trzy; 1 i 2 zastosowane, 3 — osobny `/fix`):

1. Szablon zadania (`.claude/skills/plan-backlog/templates/task.md`), punkt „UI tasks”: każdy wiersz tabeli „States” dotkniętego ekranu ma kryterium akceptacji z testem, łącznie z fokusem i ogłoszeniami, a nie tylko skan axe.
2. QA round 1 #1 (minor): dopisać 2 testy przypinające zawężenia — lista z pozycjami po otwarciu nie przenosi fokusu; lista opróżniona przez odświeżenie danych nie przenosi fokusu.
3. QA round 1 #2 (minor, poza zakresem, kod sprzed T-011): SEC3 w `e2e/j02-listy.spec.ts:90` używa stałego `x-forwarded-for: 10.200.0.2` przy limicie rejestracji na IP, więc powtórzone przebiegi E2E w ciągu godziny oblewają. Osobny `/fix`: wspólny helper drugiego klienta z losowym IP (jak `fixtures.ts`) i sprawdzenie w CI, które odrzuca literalny `x-forwarded-for` w specach.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-28)

Verdict: pass

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | web (testy) | Test nie przypina zawężeń poprawki: „tylko przy pustej liście” i „tylko przy wejściu” (SC-06 „Accessibility”: zmiany innych osób nie przenoszą fokusu). Dwa mutanty przeżywają: fokus bezwarunkowo przy montowaniu oraz fokus przy każdym opróżnieniu listy (`[list.items.length]`). | Spot-check w `Items.tsx`: `addNameRef.current?.focus()` bez warunku → testy SC-06 45/45 zielone; warunek `list.items.length === 0` z zależnością `list.items.length` → 45/45 zielone (przywrócone `git checkout`). | Test: lista z pozycjami po otwarciu nie przenosi fokusu do „Co kupić?”; lista opróżniona przez odświeżenie danych (inna osoba) nie przenosi fokusu. |
| 2 | minor | web (E2E, poza zakresem) | SEC3 w `e2e/j02-listy.spec.ts` rejestruje drugie konto ze stałym `x-forwarded-for: 10.200.0.2`, a `signUpPerIp` = 5 / h. Kolejne przebiegi E2E w ciągu godziny wyczerpują limit i SEC3 oblewa na „Moje listy” po rejestracji Bartka. | `playwright test e2e/j02-listy.spec.ts --project=komputer --repeat-each=6` → 17/18, `x 17 SEC3 …` `expect(locator).toBeVisible() failed` (j02-listy.spec.ts:94). Kod sprzed T-011. | Losowy adres jak w `fixtures.ts` (wspólny helper drugiego klienta). |
| 3 | note | web (E2E) | Pierwszy pełny `pnpm test:e2e` w tej rundzie: 21/22 (jeden test w `j02-listy.spec.ts`, log nie zachowany — prawdopodobnie #2). Drugi pełny przebieg 22/22; przepływy z pustą listą (J-02 :24, J-03 :33) `--repeat-each=8` → 32/32. | Logi w scratchpadzie QA. | — |
| 4 | note | a11y | Fokus programowy przeskakuje tekst pustego stanu; czytnik ogłosi pole „Co kupić?”, ale nie „Lista jest pusta…”. Spec tego nie wymaga. Ręczny test czytnikiem ekranu: nie wykonany (brak czytnika w środowisku QA). | — | Do rozważenia: `aria-describedby` pola na tekst pustego stanu, gdy lista jest pusta. |

**Reprodukcja.** `pnpm install --frozen-lockfile` bez zmian w śledzonych plikach. `pnpm check` (Prettier, ESLint, `tsc`, jscpd, dependency-cruiser, design-check 0 błędów, backlog-check OK, Vitest **49 plików / 245 testów**) zielony. `pnpm build` OK. `pnpm test:e2e` 22/22 (patrz #3).

**Kryteria.**
- AC1: **pass**. Test „focuses the add field when an empty list opens (SC-06 Empty, T-011)” asertuje tekst pustego stanu i `toHaveFocus()` na polu „Co kupić?”. Spot-check: bez `focus()` test oblewa (`Received element with focus: <body>`). W prawdziwej przeglądarce (Chromium, 390 px i 1280 px, tymczasowy spec Playwright, usunięty): po utworzeniu listy fokus w „Co kupić?”; przy wolnym wczytaniu (1,5 s) w trakcie Loading fokus na `<body>`, pole nieaktywne, po wczytaniu fokus w polu; błąd wczytania → „Spróbuj ponownie” → po wczytaniu pustej listy fokus w polu.
- AC2: **pass**. Lista z pozycjami po odświeżeniu: fokus na `<body>` (bez zmian). Dodanie: fokus zostaje w polu. Usunięcie ostatniej pozycji: fokus w polu. E2E J-02, J-03 zielone; testy SC-06 45/45.

**Fix task.** „Root cause” wyjaśnia, czemu testy nie złapały błędu (reguła z tabeli „States” nie trafiła do kryteriów T-006; E2E sprawdzało tylko tekst i axe). Test odtwarzający oblewa bez poprawki (spot-check wyżej).

**Code review.** Zmiana minimalna, w komponencie, który już zarządza fokusem pustego stanu (`Items`). `useRef` z wartością początkową poprawnie ogranicza efekt do wejścia; brak scope creep. Security: brak zmian po stronie API, brak danych w logach.

`git status` po spot-checkach i teście w przeglądarce: czysty.

### Po QA round 1 (2026-10-28, decyzja użytkownika)

- **Propozycja 1** — szablon zadania, „Acceptance criteria”: w zadaniach UI każdy osiągalny wiersz tabeli „States” dotkniętego ekranu ma kryterium (z fokusem i ogłoszeniami), wiersze odłożone są nazwane w „Implementation notes”.
- **Propozycja 2 (QA #1)** — `ListScreen.add.test.tsx`: „leaves focus alone when a list with items opens (T-011)” i „does not move focus when the list becomes empty after a refresh (T-011)” (odświeżenie przez `focusManager`, jak po powrocie do karty). Przechodzą na obecnym kodzie (przypinają zachowanie). Spot-check: mutant „fokus zawsze przy montowaniu” → pada tylko pierwszy z nich; mutant „fokus przy każdym opróżnieniu” (`[list.items.length]`) → pada tylko drugi; `Items.tsx` przywrócony. Testy SC-06 47/47.
