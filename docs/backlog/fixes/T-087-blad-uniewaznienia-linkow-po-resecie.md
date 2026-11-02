---
id: T-087
title: "Reset hasła: błąd unieważnienia pozostałych linków nie pomija zamknięcia połączeń i logu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa                 # todo | in-progress | in-qa | done | blocked
depends_on: [T-075]
layers: [backend]
requirements: [F-03]
threats: [TH-10, TH-28]
screens: [SC-03]
related_tasks: [T-054, T-075]
---

# T-087 Reset hasła: błąd unieważnienia pozostałych linków nie pomija zamknięcia połączeń i logu

## Report

Źródło: QA T-075 runda 1, uwaga minor.

- **Actual:** w `POST /api/auth/reset-password` (`apps/api/src/modules/konta/http/auth-routes.ts`, `newPasswordRoute`) `resetTokens.revokeAll(userId)` działa po zatwierdzeniu zmiany hasła przez Better Auth i poza jego transakcją. Jeśli DELETE w `verification` się nie uda (błąd bazy, zerwane połączenie), wyjątek przerywa trasę: klient dostaje `500 internal`, choć hasło jest już zmienione i sesje usunięte. Pominięte zostają też zdarzenie `password_reset` w logu `security` i `deps.onPasswordReset` (`live.closeUser`, TH-28), więc otwarte połączenia na żywo konta zostają aktywne do najbliższej kontroli sesji przy pingu.
- **Expected:** udana zmiana hasła zawsze kończy się zdarzeniem `password_reset` w `security` i zamknięciem połączeń na żywo konta (T-054, TH-28). Błąd unieważnienia pozostałych linków trafia do logu (bez tokenów, TH-21) i nie zmienia wyniku zmiany hasła dla klienta (albo, jeśli tak zdecyduje implementujący, jest częścią tej samej transakcji co zmiana hasła). Źródło: AC T-054 (koniec sesji i połączeń po resecie), F-03.
- **Steps to reproduce:**
  1. Konto z dwoma linkami resetu.
  2. Spowoduj błąd zapytania `DELETE FROM verification …` (np. podmieniony `ResetTokens.revokeAll` przez `AppOptions` albo pula, która odrzuca to zapytanie).
  3. Ustaw nowe hasło jednym linkiem: odpowiedź 500, brak `password_reset` w logu `security`, połączenie WS konta nie zostaje zamknięte.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 2388a0a.
- **Evidence:** raport QA T-075 runda 1 (`docs/backlog/fixes/T-075-reset-uniewaznia-inne-linki.md`, sekcja QA).

## Acceptance criteria

- [x] AC1: Given zmiana hasła udana w Better Auth, when unieważnienie pozostałych linków konta się nie uda, then w logu `security` jest `password_reset`, połączenia na żywo konta są zamknięte, a błąd unieważnienia jest w logu (`errorSummary`, bez tokenu). — verified by: test integracyjny
- [x] AC2: Given ten sam przypadek, then odpowiedź klienta jest zgodna z kontraktem SC-03 (decyzja implementującego zapisana w Root cause: 200, bo hasło zmienione; albo cała operacja w jednej transakcji i wtedy hasło niezmienione). — verified by: test integracyjny
- [x] AC3: No regression in: T-075 (wszystkie AC), T-054 (wszystkie AC), T-053.

## TDD plan

**Seam:** `POST /api/auth/reset-password` przez `buildTestApp` z przechwyconym mailem (`test/reset-token.ts`); błąd zapisu wstrzyknięty przez publiczną zależność (`AppOptions`), nie `vi.mock` (pułapka `isolate: false` w `backend.md`).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Błąd unieważnienia: `password_reset` w `security`, WS konta zamknięte, błąd w logu | integration | Vitest + Testcontainers | AC1 |
| 2 | Odpowiedź klienta przy błędzie unieważnienia | integration | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api password-reset`

## QA plan

- **Regression:** SC-03 krok 2, testy T-075 (`other reset links of the account`), `live.password-reset.test.ts`, `password-reset.logs.test.ts`.
- **Edge cases:** błąd unieważnienia przy równoczesnym drugim resecie tego samego konta (kolejka `ResetTokens.exclusive` nie może się zablokować); brak tokenów w logu błędu.
- **Platforms:** API.

## Root cause

`newPasswordRoute` (T-075) wołał `resetTokens.revokeAll` bezpośrednio po udanym `forward` do Better Auth, a przed `logSecurity` i `onPasswordReset`. Transakcja Better Auth (zmiana hasła, usunięcie sesji, zużycie tokenu) jest już wtedy zatwierdzona, więc wyjątek z DELETE przerywał trasę: wynik 500, brak `password_reset` w logu i brak `live.closeUser`. Istniejące testy (T-054, T-075) sprawdzały tylko ścieżkę, w której baza działa. Żaden test nie wstrzykiwał błędu zapytania po zatwierdzeniu zmiany hasła.

**Decyzja (AC2): 200.** Hasło jest zmienione, a sesje usunięte, więc klient dostaje sukces zgodny z SC-03. Błąd sprzątania trafia do logu (`event: reset_tokens_revoke_failed`, `userId`, `err: errorSummary`, bez tokenu, TH-21). Wspólna transakcja z Better Auth wymagałaby wejścia w jego wewnętrzny `reset-password`, co jest za dużą zmianą jak na `/fix`. Koszt decyzji: w tym rzadkim przypadku pozostałe linki konta działają do wygaśnięcia (najwyżej 1 h, F-03). Błąd w logu na poziomie `error` daje sygnał do reakcji.

**Poprawka:** `auth-routes.ts`, `revokeOtherLinks` łapie błąd `revokeAll` i go loguje. Kolejka `ResetTokens.exclusive` nie dostaje odrzucenia.

**Ten sam wzorzec gdzie indziej:** w tej trasie nie ma innych działań po zatwierdzeniu, które mogłyby przerwać `onPasswordReset`. W `sign-out` (`onSignedOut`) między `forward` a zamknięciem połączeń nie ma zapytań do bazy, więc problem tam nie występuje.

## Evidence

- Test reprodukujący: `apps/api/test/password-reset.revoke-failure.test.ts`, `still logs password_reset, closes live connections and answers 200 (AC1, AC2)`. Błąd wstrzykuje `test/failing-pool.ts` (pula, która odrzuca zapytanie `DELETE FROM verification … LIKE`, wzorzec `gated-pool.ts`, bez `vi.mock`). Przed poprawką: `AssertionError: expected { status: 500, …(1) } to deeply equal { status: 200, body: {} }` (`internal`).
- Test sprawdza też: `password_reset` w `security`, WS konta zamknięty 1008, wpis błędu bez tokenów i e-maila, kolejka nie zablokowana (drugi link po błędzie daje 200).
- Po poprawce: `pnpm vitest run --project api password-reset` → 6 plików, 28 testów zielonych. `pnpm test` → 146 plików, 1149 testów zielonych. Projekt `api` w losowej kolejności (seed 7, 42, 1087) → zielony. `format:check`, `lint`, `typecheck`, `quality`, `build` → czysto.

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
