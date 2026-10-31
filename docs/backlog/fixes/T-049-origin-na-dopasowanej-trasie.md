---
id: T-049
title: "Sprawdzenie Origin obejmuje każde żądanie zmieniające stan w /api/v1"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: high         # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: []
threats: [TH-14, TH-26]
screens: []
related_tasks: [T-004, T-009]
---

# T-049 Sprawdzenie Origin obejmuje każde żądanie zmieniające stan w /api/v1

## Report

Źródło: przegląd bezpieczeństwa `docs/security/reviews/E-01-2026-10-31-1.md`, znalezisko #2 (medium; zadanie zatwierdzone przez właściciela z `severity: high`, bo chroni każdą zmianę stanu).

- **Actual:** hook `trustedOrigin` (`apps/api/src/http/trusted-origin.ts:12`) decyduje o kontroli na podstawie prefiksu surowego `request.url`. Router Fastify dopasowuje trasę po innej postaci ścieżki, więc część żądań trafiających do tras `/api/v1` omija kontrolę. Mutacje list, pozycji i zaproszeń (POST, PATCH, DELETE) przechodzą z obcym originem i bez nagłówka `Origin`. Dziś nie da się tego wykorzystać, bo `SameSite=Lax` nie wysyła ciasteczka z innej witryny, a `fly.dev` jest na liście Public Suffix. Ochrona przed CSRF ma jednak tylko jedną działającą warstwę zamiast dwóch.
- **Expected:** każde żądanie zmieniające stan, które trafia do trasy `/api/v1/*`, bez zaufanego `Origin` dostaje 403 `invalid_origin`, niezależnie od zapisu ścieżki. Źródło: TH-14, `backend.md` „Zasady bezpieczeństwa”, TH-26.
- **Steps to reproduce:** przekazane właścicielowi poza repozytorium (repozytorium publiczne); dopisać tu po wydaniu poprawki.
- **Environment:** lokalnie, `bf435ce`.
- **Evidence:** próby #A39, #A45 i #C63–C69 w raporcie przeglądu. Kanoniczna ścieżka daje 403, wariant daje 201/200/204. Upgrade WS (`na-zywo/http/routes.ts`) sprawdza `Origin` na trasie i nie ma tej luki.

## Acceptance criteria

- [ ] AC1: Given żądanie POST, PATCH lub DELETE, które router kieruje do trasy `/api/v1/*`, when brak `Origin` albo `Origin` obcy, then 403 `invalid_origin` i baza bez zmian, także dla wariantów zapisu ścieżki z raportu. — verified by: test integracyjny wariantów ścieżki w `origin.test.ts`
- [ ] AC2: Given te same warianty ścieżki dla `/api/auth/*`, when obcy Origin, then odmowa (403) zamiast 500, a sesja ani konto nie powstaje. — verified by: test integracyjny
- [ ] AC3: Decyzja w hooku opiera się na dopasowanej trasie (`request.routeOptions.url`) albo obejmuje każdą metodę zmieniającą stan. `backend.md` ma regułę z TH-26. — verified by: przegląd kodu w QA
- [ ] AC4: No regression in: J-01–J-05, `origin.test.ts`, `live.upgrade.test.ts`, E2E.

## TDD plan

**Seam:** HTTP API (`fastify.inject`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `rejects state-changing requests to /api/v1 routes without a trusted Origin, whatever the path spelling` | integracja | Vitest + Testcontainers | AC1 |
| 2 | `rejects auth requests with a foreign Origin on path variants without a 500` | integracja | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api origin`

## QA plan

- **Regression:** wszystkie mutacje list, pozycji i zaproszeń z web (E2E J-02–J-05); bezpieczne metody (GET) nadal bez wymogu `Origin`.
- **Edge cases:**
  - warianty zapisu ścieżki z raportu przeglądu (u właściciela);
  - ukośnik na końcu;
  - query string;
  - nieznana trasa: 404, nie 403.
- **Platforms:** API.

## Root cause

<Uzupełnia /fix.>

## Evidence

<Uzupełnia /fix.>

## Prevention

Propozycja z przeglądu: reguła w `backend.md` „decyzje bezpieczeństwa na `routeOptions.url`, nie na prefiksie `request.url`” oraz reguła lintu zakazująca `request.url.startsWith` w `apps/api/src/http/**` (TH-26). Sprawdzić też `redactedUrl` w `apps/api/src/logging.ts`.

<!-- QA rounds are appended below by /qa-task -->
