---
id: T-050
title: "Testy weryfikujące TH-15, TH-16, TH-19, TH-21: logi treści, fixtures lintu, brak e-maila, Secure"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: high         # incident | high | normal | low
status: in-progress           # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given lista, pozycja z notatką, link zaproszenia i konto z unikalnymi znacznikami w nazwie, notatce, imieniu i e-mailu, when przejdą przez trasy `/api/v1` i WS, then przechwycony log nie zawiera żadnego znacznika. — verified by: test integracyjny logów
- [x] AC2: Given plik-fixture z naruszeniem każdej reguły bezpieczeństwa lintu (`dangerouslySetInnerHTML`, przypisanie `innerHTML`/`outerHTML`, `insertAdjacentHTML`, `sql.raw` z danymi, `localStorage`), when uruchomiony jest ESLint z konfiguracją repozytorium, then każdy plik daje błąd właściwej reguły. — verified by: test w `scripts/test` (jak T-046)
- [x] AC3: Given uczestnik listy, when czyta `GET /lists` i `GET /lists/:id` i odbiera `item.upserted` przez WS, then w odpowiedziach i zdarzeniach nie ma e-maila żadnej osoby. — verified by: test integracyjny
- [x] AC4: Given aplikacja zbudowana z originem `https://…`, when rejestracja lub logowanie ustawia ciasteczko sesji, then ma ono `HttpOnly`, `Secure` i `SameSite=Lax`. — verified by: test integracyjny
- [x] AC5: No regression in: `pnpm lint`, `pnpm test`, CI `ci-ok`.

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

Weryfikacje TH-15, TH-16, TH-19 i TH-21 powstawały razem z zadaniami E-01 (T-002, T-004, T-006, T-009) jako test „szczęśliwej ścieżki” jednej trasy: redakcja tylko na `/health` (T-002), `Secure` tylko przy rejestracji bez `HttpOnly`/`SameSite` na https (T-004), brak e-maila tylko w odpowiedzi `POST items` (T-006). Reguły bezpieczeństwa lintu (T-002) nie miały fixture, który by je wyzwalał, więc nikt nie zauważył, że zakaz obejmuje tylko `dangerouslySetInnerHTML`, a nie przypisanie `innerHTML`/`outerHTML` i `insertAdjacentHTML`. Istniejące testy nie łapały regresji, bo żaden nie sprawdzał braku danych na wszystkich trasach z treścią.

**Inne wystąpienia wzorca:** sprawdzone `document.write` i `innerHTML` w całym repo — brak użyć. Pozostałe reguły lintu z przeglądów (T-018–T-049) mają testy przez kod, którego pilnują, ale nie fixtures; poza zakresem (reguły nie są zabezpieczeniem z modelu zagrożeń).

## Evidence

Testy (zachowanie było poprawne, więc „czerwone” to mutacja kodu, cofnięta po sprawdzeniu):

- AC1 `keeps list, item and person content out of logs` (`apps/api/test/logs.content.test.ts`): rejestracja (także z zaproszeniem i z zajętym e-mailem), nieudane i udane logowanie, lista, zmiana nazwy, pozycja z notatką, zaproszenie (podgląd), WS (`item.upserted`, `list.updated`), `GET /me`, `/lists`, `/lists/:id`, 400 walidacji i 500 (`summarize`) ze znacznikami. Mutacja `request.log.info(request.body)` w `POST /api/v1/lists` → `expected '…' not to contain 'lista…'`; logger Better Auth na `debug` → `not to contain 'wlasciciel…'`.
- AC2 `scripts/test/lint-security.test.mjs` (API ESLint, konfiguracja repo, `lintText` pod nazwą istniejącego pliku): przed poprawką 5× `FAIL` (`przypisanie innerHTML`, `… przez indeks`, `outerHTML`, `insertAdjacentHTML` web i shared: `brak błędu no-restricted-syntax z TH-15; są: []`). Po dodaniu `NO_DOM_HTML` do `SAFE_SYNTAX`/`SAFE_SYNTAX_DDL` w `eslint.config.js`: 15/15 ok (w tym kontrola: `textContent`, `insertAdjacentText`, odczyt `innerHTML` przechodzą). Wersja bashowa z `eslint --stdin` trwała 3,5 min (program TS budowany przy każdym wywołaniu), wersja Node 12 s. Krok CI w jobie `static`.
- AC3 `never shows e-mails to a participant over HTTP or WS` (`apps/api/test/participant-emails.test.ts`): podgląd i przyjęcie zaproszenia, `POST items` (własny i cudzy), `GET /lists`, `GET /lists/:id`, `item.upserted` ×2 przez WS — bez e-maila Ani, Tomka i Oli. Mutacja `email: user.email` w `members` (`lists-repository.ts`) → `not to contain 'user-…'`.
- AC4 `sets a Secure, HttpOnly, SameSite=Lax session cookie on an https origin` (`apps/api/test/session-cookie.test.ts`): rejestracja i logowanie. Mutacja `useSecureCookies: false` → `expected 'better-auth.session_token=…' to match /;\s*Secure/i`. Zastępuje węższy test `marks the session cookie Secure…` z `sign-up.test.ts`.
- AC5: `pnpm format:check`, `pnpm lint`, `lint-directives.test.sh`, `pnpm typecheck`, `pnpm quality`, `backlog-check` bez błędów; `pnpm test` 96 plików / 522 testy; `pnpm test:mobile` 10/10; `pnpm build` ok.

## Prevention

Propozycja z przeglądu: każda nowa reguła lintu bezpieczeństwa dostaje plik-fixture; weryfikacja w modelu zagrożeń zawsze z asercją braku danych.

<!-- QA rounds are appended below by /qa-task -->
