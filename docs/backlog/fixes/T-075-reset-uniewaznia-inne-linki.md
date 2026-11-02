---
id: T-075
title: "Reset hasła: udany reset unieważnia pozostałe linki resetu konta"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-03]
threats: [TH-10]
screens: [SC-03]
related_tasks: [T-053, T-054]
---

# T-075 Reset hasła: udany reset unieważnia pozostałe linki resetu konta

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, P3 (minor). QA T-054 #1 zgłosiło to wcześniej; sprawa jest otwarta.

- **Actual:** po udanym resecie znika tylko użyty token (`apps/api/src/modules/konta/http/auth-routes.ts:134-145`). Inne niewykorzystane linki resetu tego konta, wysłane wcześniej w ciągu godziny, nadal pozwalają zmienić hasło.
- **Expected:** po zmianie hasła żaden starszy link resetu konta nie działa. Źródło: BRD F-03 (link jednorazowy, 1 h) i `T-054-nowe-haslo-z-linku.md:46` (SEC1). Scenariusz zagrożenia: osoba z dostępem do starego maila zmienia hasło jeszcze raz.
- **Steps to reproduce:**
  1. Poproś o link resetu dwa razy (link A i B).
  2. Ustaw nowe hasło linkiem B.
  3. Link A nadal ustawia hasło.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 7c3435f.

## Acceptance criteria

- [ ] AC1: Given dwa niewykorzystane linki resetu konta, when hasło zostaje zmienione jednym z nich, then drugi daje odpowiedź „link wygasł / nieważny” z kontraktu SC-03. — verified by: test integracyjny
- [ ] AC2: Given linki resetu innego konta, then pozostają ważne. — verified by: test integracyjny
- [ ] AC3: No regression in: T-054 (wszystkie AC), limit próśb T-053.

## TDD plan

**Seam:** `POST /api/auth/reset-password` przez `buildTestApp` z przechwyconym mailem (`reset-token.ts`).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Dwa tokeny, reset pierwszym, drugi odrzucony | integration | Vitest + Testcontainers | AC1 |
| 2 | Token innego konta nadal działa | integration | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api password-reset`

## QA plan

- **Regression:** SC-03 krok 2, wylogowanie sesji po resecie (TH-10).
- **Edge cases:** równoczesne dwa resety; reset po usunięciu konta.
- **Platforms:** API, web SC-03.

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
