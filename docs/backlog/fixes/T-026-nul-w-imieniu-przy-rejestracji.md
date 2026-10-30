---
id: T-026
title: "Imię z NUL przy rejestracji daje 400, nie 500"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
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

- [ ] AC1: Given rejestracja z imieniem zawierającym NUL, when API ją przyjmie, then odpowiada 400 `validation_failed` z `fields.name = "invalid"`, a konto nie powstaje. — verified by: test integracyjny `sign-up.test.ts`
- [ ] AC2: Given to samo pole w SC-02, when użytkownik wyśle formularz, then przy polu jest komunikat błędu (walidacja klienta tym samym schematem). — verified by: test schematu w `packages/shared/test`
- [ ] AC3: No regression in: J-01 (rejestracja), T-004.

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

<Wypełnia /fix. Sprawdzić inne schematy tekstu bez `withoutNul` w `packages/shared/src/api/`.>

## Evidence

## Prevention

## Incident note
