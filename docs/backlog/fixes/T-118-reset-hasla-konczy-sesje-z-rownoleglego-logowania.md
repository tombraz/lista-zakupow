---
id: T-118
title: "Reset hasła kończy także sesję z równoległego logowania starym hasłem"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given logowanie starym hasłem wstrzymane po weryfikacji hasła, a przed zapisem sesji, when w tym czasie kończy się reset hasła i logowanie zostaje wznowione, then logowanie nie daje działającej sesji: odpowiedź 401 `invalid_credentials` albo sesja daje 401 przy następnym żądaniu i nie otworzy WS. — verified by: test integracyjny z wstrzymaną pulą
- [ ] AC2: Given błąd zapisu nowego hasła, when reset się nie udaje, then token nie jest zużyty i stare hasło działa (atomowość kroków resetu, `transaction: true` albo równoważne). — verified by: test integracyjny z błędem bazy
- [ ] AC3: Komentarz `auth.ts:95`, T-054 i `backend.md` opisują rzeczywiste zachowanie.
- [ ] AC4: No regression in: `password-reset.new-password.test.ts`, `password-reset.revoke-failure.test.ts`, `live.password-reset.test.ts`, `sign-in*.test.ts`, J-01.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) z bazą Testcontainers i `gatedPool`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `a sign-in with the old password that overlaps a reset leaves no working session` | integracja | Vitest + Testcontainers | AC1 |
| 2 | `a failed password write keeps the token and the old password` | integracja | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api password-reset`

## QA plan

- **Regression:** J-01, reset hasła (T-053, T-054, T-075, T-087, T-088), limity logowania (TH-09).
- **Edge cases:**
  - dwa równoległe resety różnymi linkami;
  - logowanie nowym hasłem tuż po resecie (musi działać);
  - reset przy otwartym WS.
- **Platforms:** API.

## Root cause

<Do uzupełnienia przy poprawce. Wstępnie: testy sprawdzały tylko sesje sprzed resetu (sekwencyjnie), a założenie o transakcji z komentarza nie miało testu.>

## Evidence

## Prevention

Propozycja z przeglądu: linia w `backend.md` „Zasady bezpieczeństwa” o transakcji adaptera Better Auth; testy wyścigów z `gatedPool` dla mitygacji typu „wszystkie sesje”.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
