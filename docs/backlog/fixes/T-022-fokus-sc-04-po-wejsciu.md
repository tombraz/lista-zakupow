---
id: T-022
title: "Fokus na nagłówku SC-04 po wejściu linkiem (web)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
depends_on: [T-014]
layers: [web]
requirements: [N-04]
threats: []
screens: [SC-04, SC-01, SC-09]
related_tasks: [T-004, T-014]
---

# T-022 Fokus na nagłówku SC-04 po wejściu linkiem (web)

## Report

- **Actual:** SC-04 (regulamin) nie ma AppBar, więc nie dostaje obsługi fokusu z T-014. Po wejściu linkiem w tej samej karcie (SC-09 „Regulamin i polityka prywatności”, link w stopce SC-01 z `AuthPage`) fokus zostaje na `body`; czytnik ekranu nie ogłasza nowego ekranu.
- **Expected:** Po zmianie trasy fokus na `h1` „Regulamin…” (`tabIndex={-1}`) — source: `accessibility.md` „Build”: „Focus is managed on route changes” (WCAG 2.4.3), N-04; wzorzec z T-014 (`web.md`, „Pułapki”).
- **Steps to reproduce:**
  1. Zaloguj się, na SC-05 przejdź do SC-09 („Konto”).
  2. Klawiaturą przejdź do linku regulaminu i naciśnij Enter.
  3. `document.activeElement` to `body`.
- **Environment:** lokalnie; gałąź `epic/E-01-szkielet-i-wspolna-lista` (po T-014).
- **Evidence:** wykryte przy T-014 (sekcja „Root cause” i „Prevention” w `T-014-fokus-przy-zmianie-trasy.md`).

## Acceptance criteria

- [ ] AC1: Given SC-09, when użytkownik otwiera regulamin linkiem, then fokus jest na `h1` SC-04. — verified by: test RTL przejścia linkiem
- [ ] AC2: Given SC-04 otwarty z SC-01 (ta sama karta), when wejście linkiem, then fokus na `h1`; „Wróć” wraca na poprzedni ekran z jego własnym fokusem.
- [ ] AC3: No regression in: linki spisu treści przenoszą fokus do sekcji `h2` (SC-04 „Accessibility”); SC-02 otwiera regulamin w nowej karcie (bez zmian).

## TDD plan

**Seam:** router web (`renderApp` + nawigacja linkiem)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `focuses the SC-04 heading opened by keyboard from SC-09 (AC1)` (odtwarza błąd) | komponent (cała aplikacja) | Vitest + RTL + MSW | AC1 |
| 2 | `focuses the SC-04 heading opened from SC-01, and „Wróć” gives SC-01 its own focus (AC2)` | komponent | Vitest + RTL + MSW | AC2 |
| 3 | `focuses the section named in the address, not the heading (SC-02 → #polityka-prywatnosci)` | komponent | Vitest + RTL + MSW | AC3 (SC-02 link do sekcji) |
| 4 | `keeps focus on the section chosen in the table of contents (AC3)` | komponent | Vitest + RTL + MSW | AC3 |
| 5 | J-01 `SC-04 opened by keyboard from SC-01 focuses its heading; the table of contents keeps focus in the section (T-022)` | E2E | Playwright | AC1/AC2 w przeglądarce, AC3 |

**Run:** `pnpm vitest run apps/web/src/routeFocus.test.tsx`; E2E `pnpm test:e2e -g T-022`

## QA plan

- **Regression:** spis treści SC-04 (fokus na `h2`), „Wróć” do SC-01 / SC-09, SC-02 (nowa karta)
- **Edge cases:** wejście pod adres z `#polityka-prywatnosci` (SC-02 otwiera tak politykę w nowej karcie) — fokus na `h2` tej sekcji, nie na `h1` (inaczej fokus na `h1` przewinąłby stronę do góry); kliknięcie w spisie treści zmienia `#` w adresie — fokus ustawiany tylko przy montowaniu ekranu, więc nie wraca z sekcji na `h1`; pierwsze wejście / przeładowanie `/regulamin` też ustawia fokus na `h1` (jak AppBar w T-014); obwódka fokusu na `h1` — globalna `focus.ring` na jasnym tle (bez paska marki).
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

`TermsScreen` (T-004) renderuje `h1` bez `tabIndex` i bez obsługi fokusu. T-014 przeniósł zarządzanie fokusem po zmianie trasy do `AppBar`, a SC-04 nie ma AppBar, więc po nawigacji po stronie klienta fokus zostaje na `body`. Istniejące testy SC-04 (`TermsScreen.test.tsx`) startowały z `renderApp("/regulamin")` i sprawdzały tylko fokus spisu treści; `routeFocus.test.tsx` (T-014) obejmował tylko ekrany z AppBar.

Ten sam wzorzec gdzie indziej: wszystkie trasy sprawdzone (`routes.tsx`) — SC-05/06/07/09 przez `AppBar`, SC-01/SC-02 fokus w pierwszym polu (`useFocusTargets`), SC-08 własny `h1` z fokusem; SC-04 był jedynym ekranem bez obsługi.

## Evidence

- Red (przed poprawką): `routeFocus.test.tsx` — 4 nowe testy T-022 padały na `expect(element).toHaveFocus()` (fokus na `body`), m.in. `focuses the SC-04 heading opened by keyboard from SC-09 (AC1)`.
- Green: `TermsScreen.tsx` — `h1` z `tabIndex={-1}` i `useEntryFocus` (przy montowaniu fokus na `h1`, albo na `h2` sekcji wskazanej przez `#` w adresie). `pnpm vitest run --project web --project tokens`: 25 plików, 199 testów; pełny `pnpm test`: 90 plików, 435 testów zielone; `pnpm typecheck`, `pnpm lint`, `pnpm design-check`, build web — OK; `pnpm test:e2e`: 46 passed.
- Uwaga dla QA: sprawdziłem, czy E2E odróżni wariant „fokus na `h1` przy każdej zmianie `location.key`” — nie odróżnia (przechodzi też z nim; React Router nie zmienia `key` przy kliknięciu w `#`). Ochronę spisu treści daje projekt efektu (tylko przy montowaniu), a test 4 i E2E pilnują samego zachowania.
- Poza zakresem (niezweryfikowane w przeglądarce): po kliknięciu w spisie treści „Wróć” (`navigate(-1)`) prawdopodobnie cofa do `/regulamin` bez `#`, a nie na poprzedni ekran — istniało przed T-022.

## Prevention

<Uzupełnia /fix.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-30)

Verdict: pass

Weryfikacja: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm quality` (jscpd, depcruise), `pnpm design-check` — OK. `pnpm test`: 90 plików, 435 testów zielone. `pnpm test:e2e`: 46 passed (w tym test T-022 na obu projektach).

Kryteria akceptacji:

- AC1 — pass. Test 1 (`routeFocus.test.tsx`) wchodzi z SC-09 klawiaturą (Enter na linku) i sprawdza `toHaveFocus()` na `h1`. W przeglądarce (Playwright, telefon i komputer, konto z `signUp`): SC-09 → Enter na linku → `h1` SC-04 ma fokus.
- AC2 — pass. Test 2 i E2E J-01 (T-022): z SC-01 fokus na `h1`; „Wróć” wraca na SC-01 z fokusem w polu „E-mail”. W przeglądarce dodatkowo: „Wróć” z SC-04 do SC-09 daje fokus na `h1` „Konto” (AppBar, T-014); „Dalej” w historii z powrotem na SC-04 znów fokus na `h1`.
- AC3 — pass. Test 4 i E2E: link spisu treści (klik i Enter z klawiatury, obie sekcje) zostawia fokus na `h2` sekcji, nie wraca na `h1`. SC-02 bez zmian (`target="_blank"`, link do `#polityka-prywatnosci`); wejście pod `/regulamin#polityka-prywatnosci` daje fokus na `h2` „Polityka prywatności”, strona nie jest przewinięta do góry (scrollY 571 na telefonie).

Spot-checki (przywrócone, `git status` czysty): usunięcie wywołania `focus()` w `useEntryFocus` → 4 testy T-022 w `routeFocus.test.tsx` czerwone; E2E T-022 (z przebudowaniem `dist`) czerwone na obu projektach („Expected: focused, Received: inactive”).

Inne: obwódka fokusu na `h1` widoczna (`:focus-visible`, solid 3px `rgb(11, 79, 191)`), axe bez naruszeń dla `/regulamin`; Tab z `h1` idzie do pierwszego linku spisu treści. Root cause wyjaśnia, dlaczego istniejące testy nie złapały błędu (start z `renderApp("/regulamin")`, `routeFocus` tylko dla ekranów z AppBar) i obejmuje przegląd wszystkich tras.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | TDD evidence | Evidence pokazuje czerwień tylko dla testów 1–4; brak czerwieni dla testu 5 (E2E). | Sekcja „Evidence”. QA potwierdziło spot-checkiem, że E2E pada bez poprawki. | Czerwień dla każdego planowanego testu, także E2E. |
| 2 | note | Zachowanie (poza zakresem) | „Wróć” po kliknięciu w spisie treści prawdopodobnie cofa do `/regulamin` bez `#`, a nie na poprzedni ekran (zgłoszone przez autora; istniało przed T-022). | Sekcja „Evidence”, „Poza zakresem”. | Do decyzji: osobne zgłoszenie, jeśli „Wróć” ma zawsze wracać na poprzedni ekran. |
| 3 | note | Proces | Sekcja „Prevention” nadal z szablonu (`<Uzupełnia /fix.>`). | Plik zadania. | Uzupełnić w kroku prevention /fix. |
