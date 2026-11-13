---
id: T-118
title: "Reset hasła kończy także sesję z równoległego logowania starym hasłem"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: high         # incident | high | normal | low
status: done              # todo | in-progress | in-qa | done | blocked
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

## QA round 1 (2026-11-10)

Verdict: pass

Reproduction: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` OK. `pnpm test` — 157 plików, 1280/1281 zielone; jedyny błąd `routes-nul.test.ts › never logs a raw database exception for NUL input (SEC1)` (regex `/byte sequence|22021/` na całym logu, brak wpisów ≥ 50), plik pojedynczo 3× 24/24 zielony — znana niestabilność zgłoszona już w T-109 (#3). Pierwszy przebieg (zimny Docker) dał timeouty 30 s w wielu plikach, kolejne przebiegi zielone — środowisko. `pnpm vitest run --project api password-reset.race` — 3/3. J-01 E2E (`playwright test e2e/j01`) — 18/18.

Acceptance criteria:
- AC1 pass — testy 1 i 2 (`password-reset.race.test.ts`); dodatkowo własny test: wyścig z e-mailem wielkimi literami → 401, bez `set-cookie`.
- AC2 pass — test 3: po 500 stare hasło działa, sesja żyje, token działa dalej.
- AC3 pass — komentarze `infra/auth.ts`, T-054 SEC1, `backend.md` („Gdzie jest kod”, „Pułapki”, historia zmian).
- AC4 pass — pełny zestaw API (poza znaną niestabilnością wyżej) i J-01.

Spot-checks (cofnięte, `git status` czysty): bez `revokeLateSessions` pada test 2; porównanie hasha wyłączone → pada test 1; bez `transaction: true` pada test 3. Red evidence w sekcji Evidence obecne dla wszystkich 3 testów. Root cause wyjaśnia, czemu testy T-054 tego nie złapały.

Exploratory (tymczasowy plik testowy, usunięty): logowanie nowym hasłem tuż po resecie 200, starym 401; dwa równoległe resety różnymi linkami → 200 + 400, działa tylko hasło zwycięzcy; reset przy otwartym WS — `live.password-reset.test.ts` zielony.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | security | `revokeLateSessions` działa przez `bestEffort`: gdy drugie usunięcie sesji się nie uda, sesja z logowania w oknie resetu przeżywa, odpowiedź resetu to 200, a jedynym śladem jest `sessions_revoke_failed` w logu — bez alarmu do właściciela (inaczej niż `reset_tokens_revoke_failed`, T-088). | `apps/api/src/modules/konta/http/auth-routes.ts` `revokeLateSessions` | Rozważyć alarm jak dla linków albo ponowienie; okno wąskie, więc nie blokuje. |
| 2 | minor | tests | Niestabilny `routes-nul.test.ts › SEC1`: regex `/22021/` sprawdza cały log, w tym liczby (`time`, `responseTime`), więc może trafić przypadkowy ciąg cyfr; błąd powtarza się (T-109). | pełny przebieg 1 fail, pojedynczo 3× zielony; brak wpisów level ≥ 50 | Szukać `22021` tylko w polach błędu (`err.code`) albo jako osobnego tokenu. |
| 3 | note | security | Logowanie odrzucone porównaniem hasha liczy się jako nieudana próba w limicie konta (`failures.reserve` bez `release`) i loguje `sign_in_failed` — spójne z TH-09, tylko do świadomości. | `auth-routes.ts` trasa `sign-in/email` | — |
