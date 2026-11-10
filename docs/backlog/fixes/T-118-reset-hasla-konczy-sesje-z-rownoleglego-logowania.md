---
id: T-118
title: "Reset hasła kończy także sesję z równoległego logowania starym hasłem"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: high         # incident | high | normal | low
status: in-qa              # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-03]
threats: [TH-10, TH-28, TH-30]
screens: []
related_tasks: [T-054, T-075, T-087]
---

# T-118 Reset hasła kończy także sesję z równoległego logowania starym hasłem

## Report

Źródło: przegląd bezpieczeństwa `docs/security/reviews/E-02-2026-11-10-1.md`, znalezisko #1 (medium).

- **Actual:** `drizzleAdapter(db, { provider: "pg", schema })` (`apps/api/src/modules/konta/infra/auth.ts:36`) nie ma `transaction: true`, więc adapter nie otwiera transakcji. Better Auth (`resetCredentialPassword`) wykonuje kolejno: zużycie tokenu, `deleteUserSessions`, `findCredentialAccount`, `updatePassword`. Każdy krok zatwierdza się osobno. Logowanie, które zweryfikowało stary hash, zanim zapisano nowe hasło, i utworzyło sesję po usunięciu sesji, zachowuje tę sesję po resecie. Komentarz `auth.ts:95` i T-054 mówią „w tej samej transakcji”. Nawet prawdziwa transakcja (READ COMMITTED) nie zamknie całego okna, bo logowanie czyta zatwierdzony stary hash.
- **Expected:** po udanym resecie żadna sesja utworzona hasłem sprzed resetu nie działa. Źródło: TH-10 („reset unieważnia wszystkie sesje”), MC-04, BRD F-03.
- **Steps to reproduce:** przekazane właścicielowi poza repozytorium (repozytorium publiczne); dopisać tu po wydaniu poprawki.
- **Environment:** lokalnie, `cad0509`; analiza kodu Better Auth 1.7.13.
- **Evidence:** `better-auth/dist/utils/password.mjs` (`resetCredentialPassword`), `@better-auth/drizzle-adapter/dist/index.mjs` (`transaction: config.transaction ?? false`).

## Acceptance criteria

- [x] AC1: Given logowanie starym hasłem wstrzymane po weryfikacji hasła, a przed zapisem sesji, when w tym czasie kończy się reset hasła i logowanie zostaje wznowione, then logowanie nie daje działającej sesji: odpowiedź 401 `invalid_credentials` albo sesja daje 401 przy następnym żądaniu i nie otworzy WS. — verified by: test integracyjny z wstrzymaną pulą
- [x] AC2: Given błąd zapisu nowego hasła, when reset się nie udaje, then token nie jest zużyty i stare hasło działa (atomowość kroków resetu, `transaction: true` albo równoważne). — verified by: test integracyjny z błędem bazy
- [x] AC3: Komentarz `auth.ts:95`, T-054 i `backend.md` opisują rzeczywiste zachowanie.
- [x] AC4: No regression in: `password-reset.new-password.test.ts`, `password-reset.revoke-failure.test.ts`, `live.password-reset.test.ts`, `sign-in*.test.ts`, J-01.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) z bazą Testcontainers i `gatedPool`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `test/password-reset.race.test.ts` › „leaves no working session when the old hash was read before the reset (AC1)” — wstrzymany odczyt hasha przy logowaniu | integracja | Vitest + Testcontainers | AC1 |
| 2 | ten sam plik › „leaves no working session when the sign-in ends between session revocation and the password write (AC1)” — wstrzymane usunięcie sesji w transakcji resetu (`gatedPool` z `clients: true`) | integracja | Vitest + Testcontainers | AC1 |
| 3 | ten sam plik › „keeps the token, the old password and the sessions (AC2)” — błąd zapisu hasła w transakcji (`failingPool` z `clients: true`) | integracja | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api password-reset`

## QA plan

- **Regression:** J-01, reset hasła (T-053, T-054, T-075, T-087, T-088), limity logowania (TH-09).
- **Edge cases:**
  - dwa równoległe resety różnymi linkami;
  - logowanie nowym hasłem tuż po resecie (musi działać);
  - reset przy otwartym WS.
- **Platforms:** API.

## Root cause

`drizzleAdapter` bez `transaction: true` nie otwiera transakcji (`runWithTransaction` w `resetCredentialPassword` wykonuje kroki wprost), więc zużycie tokenu, usunięcie sesji i zapis hasła zatwierdzały się osobno. Logowanie Better Auth czyta zatwierdzony hash i zapisuje sesję bez żadnej koordynacji z resetem, więc nawet w transakcji (READ COMMITTED) sesja z logowania starym hasłem może powstać po usunięciu sesji w resecie — samo `transaction: true` naprawia tylko atomowość (AC2). Poprawka: `transaction: true` (`infra/auth.ts`), drugie usunięcie sesji konta po udanym resecie (`revokeLateSessions`, `bestEffort` → `sessions_revoke_failed`) i porównanie hasha hasła przed i po logowaniu (`forwardSignIn`, `infra/credentials.ts`: zmiana → sesja usunięta, 401 `invalid_credentials`, wpis `sign_in_failed`). Razem domykają okno: sesja zapisana przed drugim usunięciem ginie, a logowanie, które skończyło się po nim, widzi nowy hash przy drugim odczycie.

Dlaczego testy nie złapały: testy resetu (T-054) sprawdzały tylko sesje utworzone przed resetem, sekwencyjnie; założenie „w tej samej transakcji” z komentarza `auth.ts` i T-054 nie miało testu, a `failingPool` / `gatedPool` nie sięgały zapytań w transakcjach.

Inne wystąpienia: brak. Inne mitygacje „wszystkie sesje” — usunięcie konta (T-062) to jedna transakcja z blokadą wiersza konta, a sesja logowania po usunięciu nie przejdzie klucza obcego; wylogowanie dotyczy jednej sesji. `transaction: true` obejmuje też rejestrację (użytkownik + konto) — testy rejestracji i wyścigu e-maila (`lostEmailRace`) przechodzą.

## Evidence

- **Red (przed poprawką, `8abeda8`):** `pnpm vitest run --project api password-reset.race` — 3 failed:
  - test 1: `AssertionError: expected { status: 200, …(1) } to deeply equal { status: 401, …(1) }` (logowanie starym hasłem dało sesję po resecie);
  - test 2: `AssertionError: expected 200 to be 401` (`GET /api/v1/me` sesją z logowania w trakcie resetu);
  - test 3: `AssertionError: expected 401 to be 200` (po błędzie zapisu hasła sesje konta były już usunięte, a token zużyty).
- **Green:** te same 3 testy przechodzą. Mutacje: bez `revokeLateSessions` pada test 2, bez porównania hasha pada test 1, bez `transaction: true` pada test 3.
- **Pełny zestaw:** `pnpm test` — 157 plików, 1281 testów, wszystkie zielone (pierwszy przebieg złapał 500 dla e-maila z NUL w `routes-nul.test.ts`: odczyt hasha szedł do bazy przed walidacją Better Auth; `passwordHashOf` pomija e-mail z NUL, T-070). `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm backlog-check` — OK.
- **Regresja (AC4):** `password-reset.new-password.test.ts`, `password-reset.revoke-failure.test.ts`, `live.password-reset.test.ts`, `sign-in*.test.ts`, `routes-nul.test.ts` — zielone w pełnym zestawie; J-01 (E2E) — do sprawdzenia przez QA.
- **AC3:** komentarz `auth.ts` przy `revokeSessionsOnPasswordReset` i przy adapterze, korekta w T-054 (SEC1), `backend.md` („Gdzie jest kod”, „Pułapki”, lista zdarzeń błędów, historia zmian).

## Prevention

Propozycja z przeglądu: linia w `backend.md` „Zasady bezpieczeństwa” o transakcji adaptera Better Auth; testy wyścigów z `gatedPool` dla mitygacji typu „wszystkie sesje”.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
