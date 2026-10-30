---
id: T-034
title: "Test: każdy limit nadużyć ma sprawdzone zdarzenie w logu security (także 413)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-033]
layers: [backend]
requirements: []
threats: [TH-13, TH-21]
screens: []
related_tasks: [T-027, T-033]
---

# T-034 Test: każdy limit nadużyć ma sprawdzone zdarzenie w logu security (także 413)

## Report

Źródło: Prevention T-033 (propozycja QA T-033 runda 1), przyjęte przez użytkownika 2026-10-30.

- **Actual:** limit bez zdarzenia w logu `security` wyszedł dwa razy z rzędu (T-027: limity per IP i limit uczestników przy linku; T-033: limity WebSocket). Testy limitów sprawdzały tylko status lub kod zamknięcia. Nic nie pilnuje, że nowy klucz w `RATE_LIMITS`, `BUSINESS_LIMITS` czy `LIVE_LIMITS` dostanie test logu. Limit treści HTTP 16 kB (`BODY_LIMIT_BYTES` w `apps/api/src/app.ts`, TH-13) odpowiada 413 przez handler Fastify (`isClientError` w `http/api-error.ts`) bez zdarzenia `security`.
- **Expected:** każde przekroczenie limitu nadużyć zapisuje zdarzenie w logu `security` (`architecture.md`, „Obserwowalność”; TH-21), a test pada, gdy limit nie ma sprawdzonego zdarzenia. — source: user (2026-10-30), `layers/backend.md` „Pułapki” (T-033).
- **Steps to reproduce:** dodaj nowy klucz do `RATE_LIMITS` bez logu — żaden test nie pada. Wyślij `POST /api/v1/lists` z treścią > 16 kB → 413, w logu `security` brak wpisu.
- **Environment:** lokalnie / CI; gałąź `epic/E-01-szkielet-i-wspolna-lista`.
- **Evidence:** T-027, T-033 (sekcje Root cause).

## Acceptance criteria

- [ ] AC1: Given klucze `RATE_LIMITS`, `BUSINESS_LIMITS`, `LIVE_LIMITS` (bez progów bicia serca `pingIntervalSeconds`, `pongTimeoutSeconds` — jawna lista wyłączeń z uzasadnieniem), when uruchomiony jest test pokrycia, then dla każdego klucza istnieje scenariusz, który przekracza limit i sprawdza zdarzenie `security` (`limit_reached` / `rate_limited`); nowy klucz bez scenariusza → test czerwony z nazwą klucza. — verified by: test pokrycia (spot-check: dodany klucz testowy → czerwony)
- [ ] AC2: Given żądanie z treścią ponad 16 kB, when API odpowie 413, then log `security` ma zdarzenie `limit_reached` z `limit: "bodyBytes"` (nazwa do potwierdzenia) i trasą, bez treści żądania. — verified by: test integracyjny logów
- [ ] AC3: Luki znalezione przez test z AC1 (np. limity logowania i rejestracji obsługiwane przez Better Auth, `invitationsCreatedPerList`) są poprawione albo — gdy poprawka wykracza poza to zadanie — zapisane jako osobne zadanie i jawnie wyłączone w teście z odwołaniem do niego.
- [ ] AC4: No regression in: T-027, T-033, `security-log.test.ts`, `body-limit.test.ts`.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) i WebSocket (`connectLive`) z przechwyconym logiem pino (`captureLogs`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `every abuse limit has a security-log scenario` (jedna tabela: klucz → scenariusz; `it.each` po wszystkich kluczach) | integracja | Vitest + Testcontainers | AC1, AC3 |
| 2 | `logs limit_reached when the request body exceeds 16 kB` | integracja | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api limits.security body-limit`

## QA plan

- **Regression:** T-027, T-033, J-01 (rejestracja i logowanie z limitami), `body-limit.test.ts`.
- **Edge cases:** wpis bez treści żądania, e-maila, tokenu i ciasteczka (TH-08, TH-21); jedno zdarzenie na przekroczenie.
- **Platforms:** API.

## Root cause

<Wypełnia /fix.>

## Evidence

## Prevention

## Incident note

<Nie dotyczy.>
