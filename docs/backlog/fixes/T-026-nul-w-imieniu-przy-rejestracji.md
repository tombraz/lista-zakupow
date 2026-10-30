---
id: T-026
title: "Imię z NUL przy rejestracji daje 400, nie 500"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend, web]
requirements: [F-01]
threats: [TH-20]
screens: [SC-02]
related_tasks: [T-004, T-005]
---

# T-026 Imię z NUL przy rejestracji daje 400, nie 500

## Report

Źródło: przegląd `docs/reviews/E-01-2026-10-30-1.md`, S3.

- **Actual:**
  - Schemat imienia w `packages/shared/src/api/account.ts:16-20` (`trim().min(1).max(NAME_MAX_LENGTH)`) nie ma `.refine(withoutNul)`. Ten warunek mają pozostałe nazwy (`packages/shared/src/api/text.ts:13-14`).
  - `{ name: "a\u0000b" }` przechodzi walidację, a PostgreSQL odrzuca INSERT.
  - Most Better Auth przy `422 FAILED_TO_CREATE_USER` nie znajduje konta (`apps/api/src/modules/konta/http/auth-routes.ts:101-107`) i odpowiada 500 `internal`.
- **Expected:** 400 `validation_failed` z kodem `invalid` dla pola `name`. Źródło: `docs/architecture/layers/backend.md:86` („Wejście, którego baza nie przyjmie (NUL w tekście), odrzuca schemat w `packages/shared`”).
- **Steps to reproduce:**
  1. `POST /api/auth/sign-up/email` z `name: "a\u0000b"` i poprawnymi pozostałymi polami.
  2. Odpowiedź: 500 `internal`.
- **Environment:** lokalnie / CI; `0bd3f0a`.
- **Evidence:** `unexpected-error.test.ts:42-59` sprawdza NUL tylko dla nazwy listy.

## Acceptance criteria

- [x] AC1: Given rejestracja z imieniem zawierającym NUL, when API ją przyjmie, then odpowiada 400 `validation_failed` z `fields.name = "invalid"`, a konto nie powstaje. — verified by: test integracyjny `sign-up.test.ts`
- [x] AC2: Given to samo pole w SC-02, when użytkownik wyśle formularz, then przy polu jest komunikat błędu (walidacja klienta tym samym schematem). — verified by: test schematu w `packages/shared/test`
- [x] AC3: No regression in: J-01 (rejestracja), T-004.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) z prawdziwą bazą; schemat w `packages/shared`

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `rejects a name with NUL (400, no account)` | integracja | Vitest + Testcontainers | AC1 |
| 2 | `signUpRequestSchema rejects NUL in name` | unit | Vitest | AC2 |

**Run:** `pnpm vitest run --project api sign-up` i `pnpm vitest run --project shared`

## QA plan

- **Regression:** J-01.
- **Edge cases:** NUL na początku, w środku i na końcu; imię złożone tylko z NUL; inne pola tekstowe kont (e-mail).
- **Platforms:** API.

## Root cause

Schemat imienia w `account.ts` powstał w T-004 (`dbca17a`), zanim T-006 (`3f0c75c`) dodał `withoutNul` w `text.ts`. T-006 objął tym warunkiem tylko nazwy list i pozycji (`requiredName`), a imienia nie przepięto, więc NUL przechodzi walidację i dopiero INSERT w PostgreSQL go odrzuca: Better Auth zwraca 422, a most odpowiada 500. Istniejące testy nie wychwyciły błędu, bo przypadek NUL był sprawdzany tylko dla nazwy listy (`unexpected-error.test.ts`), a nie w testach walidacji rejestracji.

Pozostałe pola tekstowe kont sprawdziła jednorazowa sonda HTTP (nie trafiła do repozytorium): e-mail z NUL przy rejestracji i przy logowaniu daje 400 (`z.email` / most logowania), hasło z NUL daje 401 (Better Auth haszuje je, nie zapisuje), a `invitationToken` z NUL daje 200 z `invitation_invalid`. Innych schematów tekstu bez `withoutNul` w `packages/shared/src/api/` nie ma (`live.ts`: `listId` nie dociera do bazy jako tekst, bo `requireListAccess` w `listy` najpierw sprawdza `isUuid`).

Druga część tego samego błędu (AC2) dotyczyła web: `fieldMessages.name` na SC-02 nie miało tekstu dla kodu `invalid`, więc błąd pola pokazywał się bez komunikatu. Dodano „Wpisz imię”, tak jak `invalid` → ten sam tekst co `required` przy e-mailu i jak przy nazwach list i pozycji.

## Evidence

Testy reprodukujące, czerwone przed poprawką:

- `apps/api/test/sign-up.test.ts` › `answers 400 validation_failed and creates no account: name with NUL (T-026)` — `AssertionError: expected 500 to be 400`
- `packages/shared/test/account.test.ts` › `rejects NUL anywhere in the name, which the database cannot store (T-026)` (NUL na początku, w środku, na końcu, samo NUL) — `AssertionError: expected {} to deeply equal { name: 'invalid' }`
- `apps/web/src/screens/SC-02-rejestracja/SignUpScreen.test.tsx` › `explains under „Imię” that a pasted NUL character cannot be saved (T-026)` — czerwony już po poprawce schematu: podsumowanie błędów bez tekstu (`toHaveTextContent` „Popraw 1 pole” → pusty)

Poprawka: `.refine(withoutNul, { error: "invalid" })` w schemacie imienia (`packages/shared/src/api/account.ts`) oraz `name.invalid` w `apps/web/src/screens/SC-02-rejestracja/messages.ts`. Po poprawce: `pnpm test` 91 plików / 464 testy zielone; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality`, `pnpm build` bez błędów.

Regresja: J-01 (rejestracja) i T-004 — pełne pliki `sign-up*.test.ts`, `account.test.ts` i `SignUpScreen.test.tsx` zielone.

## Prevention

Co by zapobiegło: jedna definicja reguły „nazwa: trim, 1–max, bez NUL”. Imię miało własną kopię, która nie dostała `withoutNul`, gdy T-006 dodał ten warunek dla nazw list i pozycji.

Przyjęte przez użytkownika (2026-10-30, także uwaga minor z QA runda 1):

1. `const name = requiredName(NAME_MAX_LENGTH)` w `packages/shared/src/api/account.ts` zamiast ręcznej kopii (zachowanie bez zmian).
2. Wpis w „Pułapkach” `docs/architecture/layers/backend.md`: każdy tekst z żądania, który trafia do bazy, przez `requiredName` albo `.refine(withoutNul)`.

Odrzucone: reguła lint na goły `z.string()` w `packages/shared/src/api/`, bo dawałaby fałszywe alarmy dla haseł, identyfikatorów i tokenów.

## Incident note

## QA round 1 (2026-10-30)

Verdict: pass

Odtworzenie: `pnpm install --frozen-lockfile`, `pnpm test` (464/464 zielone, w tym Testcontainers), `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm quality` (jscpd, depcruise) — bez błędów. `design-check --scan apps/web/src/screens/SC-02-rejestracja` — 0 wartości zakodowanych na sztywno.

Kryteria:

- AC1 — pass. `sign-up.test.ts` › `name with NUL (T-026)` sprawdza 400, `{ code: "validation_failed", fields: { name: "invalid" } }` i pustą tabelę `"user"` przez prawdziwy most HTTP i bazę. Spot-check: bez `.refine(withoutNul)` test czerwony `expected 500 to be 400` (błąd z raportu odtworzony, poprawka go usuwa).
- AC2 — pass. `account.test.ts` sprawdza NUL na początku, w środku, na końcu i samo NUL; `SignUpScreen.test.tsx` sprawdza podsumowanie „Popraw 1 pole”, komunikat „Wpisz imię” powiązany z polem (`aria-describedby`) i brak żądania do API. Spot-check: bez `refine` czerwone testy schematu i ekranu; bez `name.invalid` w `messages.ts` czerwony test ekranu. Tekst „Wpisz imię” jest w tabeli stanów SC-02.
- AC3 — pass. Pełne pliki `sign-up*.test.ts`, `account.test.ts`, `SignUpScreen.test.tsx` i cały zestaw zielone.

Root cause: wyjaśnia, dlaczego testy nie złapały błędu (NUL sprawdzany tylko dla nazwy listy). Test reprodukujący bez poprawki jest czerwony (spot-check wyżej). TH-20: próba z NUL w imieniu przeciwko lokalnemu API (Testcontainers) daje teraz 400 i brak konta; żaden błąd bazy nie dociera do klienta.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | kod (duplikacja wiedzy) | Schemat `name` w `packages/shared/src/api/account.ts:17-22` jest teraz identyczny z `requiredName(NAME_MAX_LENGTH)` z `text.ts`; reguła „nazwa = trim, 1–max, bez NUL” jest zapisana dwa razy, a właśnie takie rozejście się kopii spowodowało ten błąd. | diff `c0b67db` | `const name = requiredName(NAME_MAX_LENGTH);` |
