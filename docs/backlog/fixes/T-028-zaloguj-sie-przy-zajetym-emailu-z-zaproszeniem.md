---
id: T-028
title: "„Zaloguj się” w komunikacie o zajętym e-mailu zachowuje zaproszenie i e-mail"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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

<Wypełnia /fix. Link do resetu w tym samym komunikacie prowadzi do nieistniejącej trasy `/reset-hasla` (przegląd P2, minor): rozważyć przy okazji.>

## Evidence

## Prevention

## Incident note
