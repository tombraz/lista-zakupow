---
id: T-050
title: "Testy weryfikujące TH-15, TH-16, TH-19, TH-21: logi treści, fixtures lintu, brak e-maila, Secure"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: high         # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend, web, infra]
requirements: [F-10]
threats: [TH-15, TH-16, TH-19, TH-20, TH-21]
screens: []
related_tasks: [T-002, T-004, T-006, T-009, T-044, T-046]
---

# T-050 Testy weryfikujące TH-15, TH-16, TH-19, TH-21: logi treści, fixtures lintu, brak e-maila, Secure

## Report

Źródło: przegląd bezpieczeństwa `docs/security/reviews/E-01-2026-10-31-1.md`, znaleziska #3 i #4 (medium, słaba weryfikacja). Zachowanie jest dziś poprawne, ale żaden test nie złapie regresji.

- **Actual:**
  - TH-21: `logging.test.ts` sprawdza redakcję tylko na `/health`. Żaden test nie sprawdza, że nazwy list i pozycji, notatki i imiona nie trafiają do logów tras `/api/v1`. Redakcja nie zawiera `email` ani `name`, więc chroni tylko to, że nic nie loguje treści żądań.
  - TH-15 / TH-20: reguły `no-restricted-syntax` (`dangerouslySetInnerHTML`, `sql.raw`, `localStorage`) w `eslint.config.js` nie mają testu, który by je wyzwalał. Przypisanie `innerHTML`, `outerHTML` i wywołanie `insertAdjacentHTML` nie są zakazane.
  - TH-19: tylko `items.create.test.ts` sprawdza brak e-maila. Brak asercji dla uczestnika w `GET /api/v1/lists`, `GET /api/v1/lists/:id` i w zdarzeniach WS (`item.upserted`).
  - TH-16: flaga `Secure` ciasteczka sesji zależy od originu `https` w Better Auth (`apps/api/src/modules/konta/infra/auth.ts:19-34`). `session-expiry.test.ts:57-69` sprawdza tylko `HttpOnly` i `Max-Age`.
- **Expected:** każda weryfikacja z kolumny „Weryfikacja” modelu zagrożeń sprawdza odmowę i brak danych. Źródło: `threat-model.md` TH-15, TH-16, TH-19, TH-21.
- **Steps to reproduce:** usunąć `HttpOnly`/`Secure`, dopisać `request.log.info(request.body)` w trasie listy albo `el.innerHTML = name` w komponencie: obecne testy i lint przechodzą.
- **Environment:** lokalnie, `bf435ce`.
- **Evidence:** raport przeglądu, tabela „Threat coverage”.

## Acceptance criteria

- [ ] AC1: Given lista, pozycja z notatką, link zaproszenia i konto z unikalnymi znacznikami w nazwie, notatce, imieniu i e-mailu, when przejdą przez trasy `/api/v1` i WS, then przechwycony log nie zawiera żadnego znacznika. — verified by: test integracyjny logów
- [ ] AC2: Given plik-fixture z naruszeniem każdej reguły bezpieczeństwa lintu (`dangerouslySetInnerHTML`, przypisanie `innerHTML`/`outerHTML`, `insertAdjacentHTML`, `sql.raw` z danymi, `localStorage`), when uruchomiony jest ESLint z konfiguracją repozytorium, then każdy plik daje błąd właściwej reguły. — verified by: test w `scripts/test` (jak T-046)
- [ ] AC3: Given uczestnik listy, when czyta `GET /lists` i `GET /lists/:id` i odbiera `item.upserted` przez WS, then w odpowiedziach i zdarzeniach nie ma e-maila żadnej osoby. — verified by: test integracyjny
- [ ] AC4: Given aplikacja zbudowana z originem `https://…`, when rejestracja lub logowanie ustawia ciasteczko sesji, then ma ono `HttpOnly`, `Secure` i `SameSite=Lax`. — verified by: test integracyjny
- [ ] AC5: No regression in: `pnpm lint`, `pnpm test`, CI `ci-ok`.

## TDD plan

**Seam:** HTTP API i WS z przechwyconym logiem pino; ESLint uruchamiany na fixtures

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `keeps list, item and person content out of logs` | integracja | Vitest + Testcontainers | AC1 |
| 2 | fixtures reguł bezpieczeństwa lintu | skrypt | bash / Node (jak `lint-directives.test.sh`) | AC2 |
| 3 | `never shows e-mails to a participant over HTTP or WS` | integracja | Vitest + Testcontainers | AC3 |
| 4 | `sets a Secure, HttpOnly, SameSite=Lax session cookie on an https origin` | integracja | Vitest + Testcontainers | AC4 |

**Run:** `pnpm vitest run --project api logs live sign-in` i skrypt fixtures lintu

## QA plan

- **Regression:** lint całego repo bez nowych naruszeń; CI.
- **Edge cases:**
  - znaczniki w e-mailu przy rejestracji z zaproszeniem;
  - log błędu 500 (`summarize`).
- **Platforms:** API, web (lint).

## Root cause

<Uzupełnia /fix.>

## Evidence

<Uzupełnia /fix.>

## Prevention

Propozycja z przeglądu: każda nowa reguła lintu bezpieczeństwa dostaje plik-fixture; weryfikacja w modelu zagrożeń zawsze z asercją braku danych.

<!-- QA rounds are appended below by /qa-task -->
