---
id: T-048
title: "Logowanie: limit per IP przed zapisem licznika nieudanych prób"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: high         # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend, db]
requirements: [F-02]
threats: [TH-13, TH-27]
screens: []
related_tasks: [T-004, T-034, T-040]
---

# T-048 Logowanie: limit per IP przed zapisem licznika nieudanych prób

## Report

Źródło: przegląd bezpieczeństwa `docs/security/reviews/E-01-2026-10-31-1.md`, znalezisko #1 (high).

- **Actual:** `POST /api/auth/sign-in/email` woła `failures.reserve(accountKey)` (`apps/api/src/modules/konta/http/auth-routes.ts:68`) przed `forward()`. Limit per IP (`signInPerIp`, Better Auth) działa dopiero wewnątrz `forward()`. `reserve()` to `INSERT … ON CONFLICT` (`apps/api/src/modules/konta/infra/sign-in-failures.ts:33-49`), więc każda próba z nowym e-mailem dokłada wiersz do `sign_in_failure`, także gdy odpowiedź to 429. Po 429 `release()` robi drugi zapis i zostawia wiersz z `failures = 0`. Tabela nie ma sprzątania, które zapowiada `data-model.md:134` (zaplanowane w E-02, S-02-05).
- **Expected:** po przekroczeniu limitu per IP żądanie nie pisze do bazy, a tabela liczników ma ograniczony rozmiar. Źródło: TH-13, MC-05 („Rejestracja jest ograniczana, a limity blokują zapychanie danych”), TH-27.
- **Steps to reproduce:** przekazane właścicielowi poza repozytorium (repozytorium publiczne); dopisać tu po wydaniu poprawki.
- **Environment:** lokalnie, `bf435ce`.
- **Evidence:** w przeglądzie seria prób z jednego IP: 10×401 i 30×429, a `sign_in_failure` urosła o 40 wierszy.

## Acceptance criteria

- [x] AC1: Given wyczerpany limit per IP dla logowania, when z tego IP przychodzą kolejne próby z nowymi e-mailami, then API odpowiada 429 `rate_limited`, a liczba wierszy `sign_in_failure` się nie zmienia. — verified by: test integracyjny liczby wierszy
- [x] AC2: Given próba zakończona inaczej niż 401 (sukces, 429 per IP), when licznik konta wraca do 0, then wiersz konta nie zostaje w tabeli. — verified by: test integracyjny
- [x] AC3: Given limit per konto (TH-09), when równoległe próby na jedno konto z wielu IP, then nadal przechodzi najwyżej 5 porażek w oknie (bez regresji atomowości z QA T-004). — verified by: istniejący `sign-in-rate-limit.test.ts`
- [x] AC4: Przekroczenie limitu per IP zostawia jedno zdarzenie `rate_limited` w logu `security` w oknie (T-040), bez e-maila. — verified by: test logu
- [x] AC5: No regression in: J-01, `sign-in.test.ts`, `sign-in-rate-limit.test.ts`, `security-log.test.ts`.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) z bazą Testcontainers

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `does not write sign-in failure rows once the IP limit is exceeded` | integracja | Vitest + Testcontainers | AC1 |
| 2 | `removes the account counter when it returns to zero` | integracja | Vitest + Testcontainers | AC2 |
| 3 | istniejące testy limitu per konto i logu | integracja | Vitest + Testcontainers | AC3, AC4 |

**Run:** `pnpm vitest run --project api sign-in`

## QA plan

- **Regression:** J-01 (logowanie, wylogowanie), limity per IP i per konto, log `security`.
- **Edge cases:**
  - warianty e-maila (wielkość liter, spacje) przy liczniku konta;
  - limit per IP za proxy (`TRUSTED_PROXIES`);
  - równoległe żądania na granicy limitu IP.
- **Platforms:** API.

## Root cause

W T-004 (QA round 1, `6bfadc9`) licznik konta przeniesiono na atomową rezerwację `reserve()` przed sprawdzeniem hasła, żeby równoległe próby nie mijały limitu. Limit per IP był wtedy tylko w Better Auth, czyli wewnątrz `forward()`, za rezerwacją. Każda próba pisała więc do `sign_in_failure`, także po 429 per IP. `release()` tylko zmniejszał licznik i zostawiał wiersz z `failures = 0`. Testy limitów sprawdzały status i log, ale nie liczyły wierszy, a TH-27 („limit przed pierwszym zapisem”) dopisano do modelu zagrożeń dopiero w przeglądzie E-01.

Ten sam wzorzec gdzie indziej: brak. Rejestracja pisze dopiero w Better Auth, za jego limitem per IP. Podgląd zaproszenia tylko czyta, a przyjęcie wymaga sesji.

Poprawka: trasa logowania jest w zakresie `perIpRateLimit` z `perIp("signInPerIp")` (`@fastify/rate-limit`, hook `onRequest`, przed walidacją i `reserve()`). Limit Better Auth w bazie zostaje za nim jako druga linia, np. po restarcie API. `release()` usuwa wiersz, gdy licznik wraca do 0.

## Evidence

- Red (`apps/api/test/sign-in-rate-limit.test.ts`):
  - `does not write sign-in failure rows once the IP limit is exceeded`: `expected 30 to be 10` (każda z 20 prób z 429 dopisała wiersz);
  - `removes the account counter when it returns to zero`: `expected 1 to be +0`.
- Green: oba przechodzą; `pnpm vitest run --project api sign-in security-log limits.security`: 31/31.
- Pełny `pnpm test`: 93 pliki, 517 testów, wszystkie zielone. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm quality`: bez błędów.

## Prevention

Propozycja z przeglądu: reguła „limit przed zapisem” na trasach bez uwierzytelnienia w `backend.md` (TH-27) i szablon testu „liczba wierszy stała po przekroczeniu limitu”.

Błędowi zapobiegłby test liczący wiersze po przekroczeniu limitu; dotychczasowe testy sprawdzały tylko status i log. Właściciel zaakceptował (2026-10-31):

1. Automatyczna kontrola: w tabeli `apps/api/test/limits.security.test.ts` każdy scenariusz woła `atLimit()` po osiągnięciu limitu, a harness sprawdza, że potem żadna tabela w `public` nie przybrała wierszy. Na kodzie sprzed poprawki `signInPerIp` pada (`sign_in_failure` 10 → 13), z poprawką 15/15. Nowy limit bez `atLimit()` też pada.
2. Pułapka w `docs/architecture/layers/backend.md`: limit per IP przed pierwszym zapisem na trasie bez uwierzytelnienia.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-31)

Verdict: pass

Odtworzenie (`99177fc`, czysty stan): `pnpm install --frozen-lockfile`, `pnpm test` 93 pliki / 517 testów zielone, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality`, `pnpm build` bez błędów. `git status` czysty po instalacji i buildzie.

Kryteria akceptacji:

- AC1 pass: `does not write sign-in failure rows once the IP limit is exceeded` liczy wiersze przed i po 20 próbach z 429. Spot-check: usunięcie `perIp("signInPerIp")` z trasy → `expected 30 to be 10`.
- AC2 pass: `removes the account counter when it returns to zero`. Spot-check: usunięcie `DELETE` w `release()` → `expected 1 to be +0`. Ścieżkę „429 z Better Auth” sprawdziłem osobno (niżej): wiersz nie zostaje.
- AC3 pass: `checks at most 5 passwords per account when attempts arrive in parallel` i pozostałe testy limitu per konto zielone.
- AC4 pass: `limits.security.test.ts` (scenariusz `signInPerIp`, 13 prób) wymaga dokładnie jednego zdarzenia `rate_limited`; `perIp` loguje z podmiotem `request.ip` i bez e-maila; `security-log.test.ts` zielony.
- AC5 pass: `sign-in.test.ts`, `sign-in-rate-limit.test.ts`, `security-log.test.ts`, J-01 (pełny suite) zielone.

Testy eksploracyjne (tymczasowe pliki w `apps/api/test/`, usunięte):

- nieprawidłowe ciało (`password: 1`, e-mail 5000 znaków) po wyczerpaniu limitu → 429 `rate_limited` przed walidacją, liczba wierszy bez zmian;
- „restart API” (nowa instancja, ten sam bazowy licznik Better Auth) → 429 z drugiej linii, `reserve()` + `release()` zostawiają liczbę wierszy bez zmian;
- równoległe żądania z jednego IP: 5 i 10 → same 401 (5 i 10 wierszy); 12 i 40 → wszystkie 429, 0 wierszy, jedno zdarzenie `signInPerIp`; inne IP dalej 401;
- warianty e-maila i `TRUSTED_PROXIES` / `X-Forwarded-For`: istniejące testy zielone, teraz przez limiter Fastify.

Root cause wyjaśnia, czemu testy nie złapały błędu (nie liczyły wierszy). Red evidence dla obu nowych testów w Evidence, zgodne z moim spot-checkiem.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | note | backend / limity | Równoległa seria ponad limit z jednego IP dostaje 429 na wszystkie żądania, także pierwsze 10 (zachowanie magazynu w pamięci `@fastify/rate-limit`; dotyczy każdej trasy z `perIp`). Fail-closed, więc nie luka, ale różni się od sekwencyjnego „10 przechodzi, 11. odmowa”. | 12 równoległych → `{"429":12}`, 0 wierszy; 10 równoległych → `{"401":10}` | Udokumentować w `backend.md` albo zaakceptować jako zamierzone. |
| 2 | minor | dokumentacja | `data-model.md:112` opisuje `reserve`/oddanie próby, ale nie mówi, że `release()` usuwa wiersz z licznikiem 0. | `docs/architecture/data-model.md:112` | Dopisać zdanie o usuwaniu wiersza na zerze (TH-27). |
| 3 | note | baza / TH-27 | Wiersze z porażkami (`failures > 0`) nadal rosną przy rotacji IP (10 na IP na minutę) do czasu sprzątania z `data-model.md:134` (E-02, S-02-05). Zgodne z zakresem tej poprawki. | analiza kodu | Sprzątanie w S-02-05. |
