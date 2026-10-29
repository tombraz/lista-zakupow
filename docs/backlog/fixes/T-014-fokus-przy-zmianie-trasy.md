---
id: T-014
title: "Fokus na nagłówku ekranu po zmianie trasy (web)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug            # bug | small-change
severity: normal     # incident | high | normal | low
status: done     # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [N-04]
threats: []
screens: [SC-05, SC-06, SC-07, SC-09]
related_tasks: [T-004, T-005, T-006, T-008, T-011]
---

# T-014 Fokus na nagłówku ekranu po zmianie trasy (web)

## Report

- **Actual:** Po przejściu linkiem między ekranami (SC-05 → SC-06 z pozycjami, SC-06 → SC-07, SC-05 → SC-09) fokus zostaje na `body`; czytnik ekranu nie ogłasza nowego ekranu. Tylko SC-08 przenosi fokus na `h1` (`InvitationScreen.tsx:58-69`).
- **Expected:** Po każdej zmianie trasy fokus na `h1` ekranu (AppBar, `tabIndex={-1}`), chyba że ekran sam ustawia fokus (pusty SC-06 → „Co kupić?”, T-011) — source: `accessibility.md` „Build”: „Focus is managed on route changes” (WCAG 2.4.3)
- **Steps to reproduce:**
  1. Zaloguj się, na SC-05 przejdź klawiaturą do karty listy z pozycjami i naciśnij Enter.
  2. `document.activeElement` to `body`.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista` (commit `03db8d6`).
- **Evidence:** przegląd `docs/reviews/E-01-2026-10-29-1.md`, #S2.

## Acceptance criteria

- [ ] AC1: Given SC-05, when użytkownik otwiera listę z pozycjami, then fokus jest na `h1` z nazwą listy. — verified by: test komponentu routera (RTL)
- [ ] AC2: Given SC-06, when przejście do SC-07 albo SC-09 i z powrotem, then fokus na `h1` nowego ekranu; pusty SC-06 nadal ustawia fokus w „Co kupić?” (T-011). — verified by: test komponentu + E2E J-02
- [ ] AC3: No regression in: T-011 (fokus pustej listy), SC-08 (własny fokus), powrót przyciskiem „wstecz” przeglądarki.

## TDD plan

**Seam:** router web (`renderApp` + nawigacja linkiem)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `focuses the list name heading when SC-05 opens a list with items (AC1)` (odtwarza błąd) | komponent (cała aplikacja) | Vitest + RTL + MSW | AC1 |
| 2 | `focuses the add field, not the heading, when SC-05 opens an empty list (AC2, T-011)` | komponent | Vitest + RTL + MSW | AC2, AC3 |
| 3 | `focuses the heading of SC-07 and of SC-06 again after going there and back (AC2)` | komponent | Vitest + RTL + MSW | AC2 |
| 4 | `focuses the heading of SC-09 opened from SC-05 (AC2)` | komponent | Vitest + RTL + MSW | AC2 |
| 5 | `focuses the heading of SC-05 after the browser back button (AC3)` | komponent | Vitest + RTL + MSW | AC3 |
| 6 | J-02: po „Wstecz” z SC-06 `h1` „Moje listy” ma fokus | E2E | Playwright | AC2 |
| 7 | `waits for the list name before focusing the SC-06 heading` (QA r1 #2) | komponent | Vitest + RTL + MSW | strażnik `named` |
| 8 | `T-014 focuses the AppBar heading after a keyboard route change, with a visible ring` (QA r1 #1) | E2E | Playwright | 2.4.7: obwódka `focus.ring-on-brand` |

**Run:** `pnpm vitest run apps/web/src/routeFocus.test.tsx`; E2E `pnpm test:e2e` (J-02)

## QA plan

- **Regression:** T-011 (fokus pustej listy), SC-08 (własny fokus), powrót przyciskiem „wstecz” przeglądarki
- **Edge cases:** SC-06 w trakcie wczytywania (pusty tytuł — fokus dopiero, gdy `h1` ma nazwę listy); pusty SC-06 (fokus w „Co kupić?” wygrywa, bo efekt `Items` biegnie po efekcie AppBar); SC-06 „brak dostępu” (własny AppBar z tytułem → fokus na `h1`); pierwsze wejście / przeładowanie strony też ustawia fokus na `h1` (decyzja: `key` pierwszego wpisu historii to „default” także po powrocie „wstecz” do niego, więc odróżnienie pierwszego wejścia byłoby zawodne); zmiana nazwy listy nie przenosi fokusu (zależność od „ma nazwę”, nie od treści); SC-08 i ekrany bez AppBar (SC-01, SC-02, SC-04) bez zmian.
- **Platforms:** web (komputer i telefon), CI Linux

## Root cause

`AppBar` (T-004, rozbudowany w T-005) renderuje `h1` bez `tabIndex` i bez obsługi fokusu, a router (`createBrowserRouter`) nie zarządza fokusem, więc po nawigacji po stronie klienta fokus zostaje na `body` (element linku znika z DOM). Tylko SC-08 miało własny `Heading` z fokusem. Istniejące testy sprawdzały fokus wewnątrz ekranów (pola, dialogi, T-011), ale żaden nie przechodził linkiem między ekranami i nie sprawdzał `document.activeElement` po zmianie trasy — testy ekranów startują z `renderApp(adres)`, nie z nawigacji.

Ten sam wzorzec gdzie indziej: wszystkie ekrany z AppBar (SC-05, SC-06, SC-07, SC-09) — naprawione jednym miejscem (`AppBar`). Ekrany bez AppBar: SC-01 / SC-02 ustawiają fokus w pierwszym polu (`useFocusTargets`), SC-08 na `h1`; SC-04 (regulamin) nie ustawia fokusu — poza zakresem tego zadania (inny komponent, publiczna strona dokumentu); propozycja w „Prevention”.

## Evidence

- Red (przed poprawką): `routeFocus.test.tsx` — 4 z 5 testów (AC1, AC2 SC-07/SC-06, AC2 SC-09, AC3) padały na `expect(element).toHaveFocus()`: oczekiwano `<h1 class="title">Dom</h1>`, fokus na `body`. Test pustej listy (T-011) przechodził.
- Green: `apps/web/src/components/AppBar/AppBar.tsx` — `h1` z `tabIndex={-1}` i `useRouteFocus` (fokus po zmianie `location.key`, gdy tytuł niepusty). `pnpm vitest run --project web --project tokens`: 23 pliki, 168 testów zielone; `pnpm typecheck`, `pnpm lint`, `pnpm design-check`, build web — OK. Pełny `pnpm test`: 399 testów zielone; plik `apps/api/test/origin.test.ts` padł raz na poziomie zestawu (bez nieudanego testu) przy równoległym E2E, osobno 3/3 zielone — niezwiązane z warstwą web. `pnpm test:e2e`: 34 passed (J-02 z nową asercją fokusu).

## Prevention

<Uzupełnia /fix; propozycje w `docs/reviews/E-01-2026-10-29-1.md`, sekcja „Proposals”.>

## Incident note

<Nie dotyczy.>

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-29)

Verdict: fail

**Reprodukcja:** `pnpm install --frozen-lockfile` bez zmian; `pnpm vitest run apps/web/src/routeFocus.test.tsx` 5/5; `pnpm lint`, `pnpm typecheck`, `pnpm design-check`, `pnpm quality` OK; `pnpm format:check` zgłasza 3 pliki taska tylko z powodu CRLF w lokalnej kopii roboczej (zacommitowane bloby przechodzą Prettiera, patrz #3); `pnpm test` 401/402 — 1 porażka w znanym niestabilnym `InvitationScreen.entry.test.tsx` (`accepts.count` 1 zamiast 0, T-019; osobno 3 × 4/4 zielone); `pnpm test:e2e` 34 passed (J-02 z nową asercją fokusu).

**Spot-check:** zastąpienie `if (named) ref.current?.focus();` no-opem → 4 z 5 testów `routeFocus.test.tsx` czerwone (AC1, AC2 ×2, AC3), test pustej listy zielony zgodnie z założeniem; przywrócone `git checkout`.

**Kryteria:**
- AC1 — pass (test RTL + Playwright: SC-05 → Enter na karcie „Pelna” → `h1` „Pelna” ma fokus).
- AC2 — pass (SC-06 → SC-07 → wstecz → `h1` nowego ekranu; SC-05 → SC-09; pusta lista: fokus w „Co kupić?” przy pierwszym wejściu, po „Wstecz” z SC-07 i po „wstecz” przeglądarki — z danymi z pamięci podręcznej).
- AC3 — pass (T-011, SC-08 bez zmian w E2E J-04; „wstecz”/„dalej” przeglądarki ustawiają fokus na `h1`; SC-06 „brak dostępu” i przeładowanie SC-05/SC-09 → `h1`).

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | major | design / dostępność (2.4.7, design-system.md „AppBar” i „Fokus”) | Fokus na `h1` paska jest niewidoczny. Po wejściu klawiaturą `h1` dostaje `:focus-visible` i globalną obwódkę `color.focus.ring` (#0b4fbf) — w tym samym kolorze co tło paska `color.surface.brand` (#0b4fbf). Użytkownik klawiatury traci z oczu miejsce fokusu po każdej zmianie trasy. | Playwright (komputer): po Enter na karcie listy `document.activeElement` = `H1 "Pelna"`, `:focus-visible` = true, `outline: rgb(11, 79, 191) solid 3px`, tło rodzica `rgb(11, 79, 191)`; to samo dla „Moje listy”, „Konto”, „Nie masz dostępu do tej listy.”; zrzut ekranu bez widocznej obwódki. `AppBar.module.css` ma `outline-color: var(--color-focus-ring-on-brand)` tylko dla `.control`, nie dla `.title`. | Tytuł paska z fokusem ma obwódkę `color.focus.ring-on-brand` (np. `.title:focus-visible { outline-color: var(--color-focus-ring-on-brand); }`), zgodnie z „fokus `focus.ring-on-brand`” (AppBar) i „`color.focus.ring-on-brand` na pasku marki; widoczna w każdym stanie”; plus test (E2E lub komponent) sprawdzający kolor obwódki `h1` z fokusem. |
| 2 | note | testy | Strażnik „fokus dopiero, gdy tytuł niepusty” (`named`) nie ma testu, który by go bronił: usunięcie warunku nie zmieni wyniku testów (ten sam element `h1` dostaje fokus, gdy jest jeszcze pusty). | przegląd `routeFocus.test.tsx` | Opcjonalnie: asercja, że w trakcie wczytywania SC-06 fokus nie jest na pustym `h1`. |
| 3 | note | środowisko | `format:check` lokalnie zgłasza 3 pliki taska — kopia robocza ma CRLF (`core.autocrlf=true`), repozytorium LF (`.gitattributes eol=lf`); bloby w `HEAD` przechodzą Prettiera, CI niezagrożone. | `file apps/web/src/routeFocus.test.tsx` → CRLF; `git show HEAD:<plik> \| prettier --check` → OK | Brak działania w tasku; ewentualnie `core.autocrlf=false` lokalnie. |
| 4 | note | testy (poza zakresem) | Znany niestabilny test `InvitationScreen.entry.test.tsx` padł w pełnym przebiegu. | `pnpm test` 1 failed / 401 passed; osobno 3 × zielony | T-019. |

**Do zmiany:** #1 — widoczna obwódka `focus.ring-on-brand` dla `h1` w AppBar z testem, który ją sprawdza.

### Poprawki po rundzie 1 (/fix)

- #1: `AppBar.module.css` — `.title:focus-visible` dostaje `outline-color: var(--color-focus-ring-on-brand)` (jak `.control`). Najpierw test E2E 8 — czerwony: oczekiwano `rgb(255, 210, 63)`, było `rgb(11, 79, 191)`; po poprawce zielony (oba viewporty).
- #2: test 7 — czerwony po usunięciu warunku `named`, zielony z nim.
- #3, #4: bez zmian (środowisko; T-019).
- Web: 169 testów zielone; typecheck, lint, design-check OK; Prettier OK (poza CRLF kopii roboczej); E2E `-g "T-014|J-02"` 4 passed.

## QA round 2 (2026-10-29)

Verdict: pass

**Reprodukcja:** `pnpm install --frozen-lockfile` bez zmian w plikach śledzonych; `pnpm vitest run apps/web/src/routeFocus.test.tsx` 6/6; `pnpm lint`, `pnpm typecheck`, `pnpm design-check` (0 kolorów na sztywno) OK; `pnpm test` 88 plików, 403/403 zielone; `pnpm test:e2e` 36 passed (w tym nowy test 8 na obu viewportach i J-02).

**Spot-check:**
- usunięcie `.title:focus-visible` z `AppBar.module.css` + przebudowa web → test E2E 8 czerwony na obu viewportach (oczekiwano `rgb(255, 210, 63)`, otrzymano `rgb(11, 79, 191)`); przywrócone `git checkout`. Uwaga: bez przebudowy (`playwright test` bez `pnpm build`) test przechodzi na starym `dist` — `pnpm test:e2e` buduje, więc CI nie jest zagrożone.
- usunięcie warunku `named` w `AppBar.tsx` → test 7 czerwony, pozostałe 5 zielone; przywrócone.

**Kryteria:** AC1, AC2, AC3 — pass (bez zmian w logice fokusu względem rundy 1; regresje zweryfikowane pełnym E2E). Poprawka #1 z rundy 1: obwódka `h1` w pasku to `color.focus.ring-on-brand` (żółta na niebieskim tle), `:focus-visible` po wejściu klawiaturą — zgodnie z design-system „AppBar” i WCAG 2.4.7. Testy z rundy 1 nie zostały osłabione (diff testów wyłącznie dodaje testy 7 i 8).

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | testy / środowisko | Lokalne uruchomienie samego `playwright test` korzysta z istniejącego `dist`, więc zmiana CSS bez przebudowy daje fałszywie zielony wynik. | spot-check powyżej | Ewentualnie `webServer` w Playwright budujący web, albo wpis w README testów. |
| 2 | note | testy (poza zakresem) | Runda 1 #3 (CRLF w kopii roboczej) i #4 (niestabilny test T-019) — bez zmian; w tym przebiegu pełny `pnpm test` zielony. | — | T-019. |
