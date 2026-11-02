---
id: T-075
title: "Reset hasła: udany reset unieważnia pozostałe linki resetu konta"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: in-progress           # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given dwa niewykorzystane linki resetu konta, when hasło zostaje zmienione jednym z nich, then drugi daje odpowiedź „link wygasł / nieważny” z kontraktu SC-03. — verified by: test integracyjny
- [x] AC2: Given linki resetu innego konta, then pozostają ważne. — verified by: test integracyjny
- [x] AC3: No regression in: T-054 (wszystkie AC), limit próśb T-053.

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

Better Auth (1.7.13, `reset-password`) w transakcji resetu zużywa tylko użyty identyfikator `reset-password:<token>` (`consumeVerificationValue`); inne wiersze `verification` tego konta zostają do wygaśnięcia (1 h). Trasa `POST /api/auth/reset-password` (T-054) przekazywała żądanie do Better Auth i niczego nie sprzątała, a dwa różne linki zużyte naraz przechodziły oba (każdy zużywał swój wiersz). Istniejące testy AC4 T-054 sprawdzały tylko ponowne użycie **tego samego** tokenu i wyścig na jednym tokenie, nigdy dwóch linków jednego konta.

**Poprawka:** `infra/reset-tokens.ts` — `ResetTokens.exclusive` wykonuje resety jednego konta po kolei (w pamięci procesu, jedna instancja API, ADR 0003), a po udanym resecie `revokeAll` usuwa wszystkie tokeny `reset-password:%` konta. Drugi z równoczesnych resetów dostaje więc `invalid_token`. Przy okazji, by zmieścić się w `max-lines-per-function`, callback wysyłki maila resetu w `konta/index.ts` wydzielono do `sendResetMail` (bez zmiany zachowania).

**Ten sam wzorzec gdzie indziej:** inne tokeny jednorazowe w kodzie to tokeny zaproszeń (moduł `zaproszenia`, własna tabela, F-12) — inna przyczyna i inna reguła (zaproszenie per lista), nie dotyczy. Better Auth nie wydaje u nas innych wierszy `verification` (brak weryfikacji e-maila).

## Evidence

- Test reprodukujący: `apps/api/test/password-reset.new-password.test.ts` → `other reset links of the account`:
  - `refuses the other unused link once the password was changed (AC1)` — przed poprawką: `AssertionError` (link A po resecie linkiem B dawał 200 zamiast `400 invalid_token`).
  - `lets only one of two parallel resets with different links succeed` — przed poprawką: `expected [ 200, 200 ] to deeply equal [ 200, 400 ]`.
  - `keeps the reset links of another account valid (AC2)` — zielony przed i po (straż przed zbyt szerokim usuwaniem).
- Po poprawce: `pnpm vitest run --project api password-reset` → 5 plików, 27 testów zielonych; `pnpm test` → 145 plików, 1148 testów zielonych; `typecheck`, `lint`, `format:check`, `quality`, `build` — czysto.
- Regresja: T-054 (wszystkie AC w `password-reset.new-password.test.ts`), T-053 (`password-reset.test.ts`, `password-reset-rate-limit.test.ts`), wylogowanie połączeń na żywo po resecie (`live.password-reset.test.ts`) — zielone.

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
