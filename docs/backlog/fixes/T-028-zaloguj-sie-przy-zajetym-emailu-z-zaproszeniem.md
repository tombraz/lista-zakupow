---
id: T-028
title: "„Zaloguj się” w komunikacie o zajętym e-mailu zachowuje zaproszenie i e-mail"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: in-progress           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-01, F-12]
threats: []
screens: [SC-01, SC-02, SC-08]
related_tasks: [T-004, T-008]
---

# T-028 „Zaloguj się” w komunikacie o zajętym e-mailu zachowuje zaproszenie i e-mail

## Report

Źródło: przegląd `docs/reviews/E-01-2026-10-30-1.md`, P1.

- **Actual:**
  - W `EmailTaken` (`apps/web/src/screens/SC-02-rejestracja/SignUpScreen.tsx:123-130`) „Zaloguj się” to zwykły `<Link to="/logowanie">`. Nie przenosi `invitation` ani `email`.
  - Dolny przełącznik w tym samym pliku (`:112-120`) używa `EntryLink`, który je przenosi.
  - Zaproszona osoba z istniejącym kontem przechodzi SC-08 → „Załóż konto i dołącz” → 409 `email_taken` → link w komunikacie. Na SC-01 traci kontekst zaproszenia i wpisany e-mail, a po zalogowaniu trafia na SC-05 bez dołączenia do listy. Token zniknął z historii (`replace`), więc nie da się wrócić do zaproszenia.
- **Expected:** po zalogowaniu powrót do SC-08 i automatyczne dołączenie, bez ponownego wpisywania e-maila (WCAG 3.3.7). Źródło: `docs/design/screens/SC-01-logowanie.md:50`, `docs/design/screens/SC-08-zaproszenie.md:52,79`, BRD F-12.
- **Steps to reproduce:**
  1. Konto `a@x.pl` istnieje. Wylogowana osoba otwiera link zaproszenia.
  2. „Załóż konto i dołącz”, wpisuje `a@x.pl` i wysyła.
  3. Pojawia się komunikat „e-mail już użyty”. Klik „Zaloguj się”: SC-01 bez e-maila i bez zaproszenia.
  4. Po zalogowaniu trafia na SC-05, nie na listę.
- **Environment:** lokalnie / staging; `0bd3f0a`.
- **Evidence:** test T-004 AC2 sprawdza tylko `href` linku.

## Acceptance criteria

- [ ] AC1: Given SC-02 otwarte z zaproszenia i odpowiedź 409 `email_taken`, when użytkownik kliknie „Zaloguj się” w komunikacie, then SC-01 ma wpisany e-mail i informację o zaproszeniu, a po zalogowaniu użytkownik dołącza do listy i widzi SC-06. — verified by: test całej aplikacji (`renderApp`) + E2E J-04
- [ ] AC2: Given SC-02 bez zaproszenia, when `email_taken` i „Zaloguj się”, then SC-01 ma wpisany e-mail. — verified by: test komponentu SC-02
- [ ] AC3: No regression in: J-01, J-04, T-019 (jedno przekierowanie po wejściu).

## TDD plan

**Seam:** cała aplikacja (`renderApp`) z MSW; E2E J-04 na prawdziwym API

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `email_taken → „Zaloguj się” keeps the invitation and joins after sign-in` | aplikacja | Vitest + RTL + MSW | AC1 |
| 2 | `email_taken → „Zaloguj się” keeps the typed email` | komponent | Vitest + RTL + MSW | AC2 |
| 3 | J-04: zaproszona osoba z kontem przez rejestrację → logowanie → lista | E2E | Playwright | AC1 |

**Run:** `pnpm vitest run --project web SC-02` i `pnpm e2e j04`

## QA plan

- **Regression:** J-01, J-04, SC-08 (stany wygasłego i wykorzystanego linku).
- **Edge cases:** link wygasł w trakcie; e-mail wpisany inaczej wielkimi literami.
- **Platforms:** Chrome na komputerze, Safari iOS.

## Root cause

`EmailTaken` powstał w T-004 (`dbca17a`) jako zwykły `<Link to="/logowanie">`, zanim istniał kontekst zaproszenia. T-008 (`0f997f6`) dodał `EntryLink` i podmienił dolny przełącznik SC-02 oraz link na SC-01, ale pominął drugi link do SC-01 w komunikacie o zajętym e-mailu. Testy tego nie złapały, bo test T-004 AC2 sprawdzał tylko `href`, a testy przejść SC-08 → SC-01 / SC-02 (T-008 AC5) nie obejmowały odpowiedzi 409 `email_taken`.

Inne wystąpienia: brak. SC-01 → SC-02 idzie przez `EntryLink`; „Wróć” na SC-04 cofa w historii; `guards.tsx` przekierowuje z `from`. Link „zresetuj hasło” w tym samym komunikacie prowadzi do `/reset-hasla`, którego nie ma (SC-03, F-03, poza E-01) — poza zakresem tej poprawki: trasa i ekran powstaną z SC-03.

## Evidence

- Red (Vitest):
  - `SC-08 → SC-01 / SC-02 → the shared list > sign up with a taken e-mail → „Zaloguj się” keeps the invitation and joins after sign-in (T-028)` — `Unable to find an element with the text: Zaloguj się, żeby dołączyć do listy „Dom”.`
  - `SC-02 Rejestracja > „Zaloguj się” under a taken e-mail keeps the typed e-mail on SC-01 (T-028)` — `Expected the element to have value: Ania@Example.com, Received: ""`.
- Red (E2E, Playwright): `J-04 taken e-mail on sign-up from the link → sign in → shared list` — `getByText('Zaloguj się, żeby dołączyć do listy „Dom”.')`: element(s) not found (telefon i komputer).
- Green: poprawka — `EmailTaken` używa `EntryLink` z wpisanym e-mailem i kontekstem zaproszenia (`SignUpScreen.tsx`). Vitest: 91 plików, 466 testów — pass. E2E `pnpm test:e2e`: 50 passed. `pnpm typecheck`, `pnpm lint`, `pnpm design-check`, `pnpm --filter @lista/web build` — bez błędów.
- E2E wpisuje e-mail wielkimi literami (przypadek brzegowy z planu QA): 409, e-mail przeniesiony bez zmian, logowanie się udaje.
- Regresja: J-01 (`j01-konto.spec.ts`, w tym zajęty e-mail bez zaproszenia), J-04 (`j04-zaproszenie.spec.ts`), T-019 (`no second accept…`) — pass.

## Prevention

## Incident note
