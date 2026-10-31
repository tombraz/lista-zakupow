---
id: T-050
title: "Testy weryfikujące TH-15, TH-16, TH-19, TH-21: logi treści, fixtures lintu, brak e-maila, Secure"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: high         # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
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

**Co by temu zapobiegło:** kontrola, która sama pada, gdy zabezpieczenie z modelu zagrożeń przestaje działać albo nie obejmuje części kodu. Zaakceptowane przez właściciela (po QA round 1) i wdrożone:

- `scripts/test/lint-security.test.mjs` sprawdza też, że każdy blok `eslint.config.js` nadpisujący `no-restricted-syntax` zawiera wszystkie selektory `SAFE_SYNTAX` (albo `SAFE_SYNTAX_DDL` w `schema.ts`), eksportowane z konfiguracji (QA #2). Mutacja: usunięcie `...SAFE_SYNTAX` z bloku `TermsScreen.tsx` → `FAIL`, kod wyjścia 1;
- szerszy zakaz HTML w DOM (`NO_DOM_HTML`, QA #1): zapis `innerHTML`/`outerHTML`/`srcdoc` także przez szablon i literał obiektu (`Object.assign`), `setHTMLUnsafe`, `createContextualFragment`, `document.write(ln)`, `srcDoc` w JSX — każdy z fixture (22 fixtures + 11 bloków, 0 błędów; przed zmianą skrypt nie startował, bo `SAFE_SYNTAX` nie był eksportowany, a nowe fixtures nie miały reguły);
- `logs.content.test.ts` sprawdza też brak tokenu sesji (z rejestracji właściciela i gościa oraz z logowania, podpisana wartość i sam token) i tokenu zaproszenia (QA #3). Mutacje: `request.log.info({ c: request.headers.cookie })` w `POST /api/v1/lists` → `not to contain '<token sesji>'`; `request.log.info({ t: request.params.token })` w podglądzie zaproszenia → `not to contain '<token>'`;
- reguły w `backend.md` i `web.md` „Zasady bezpieczeństwa”: weryfikacja zagrożenia na wszystkich trasach z treścią i asercja braku danych; fixture dla każdej reguły lintu bezpieczeństwa.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-31)

Verdict: pass

Reprodukcja (świeży `pnpm install --frozen-lockfile`): `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm quality`, `lint-directives.test.sh`, `backlog-check` bez błędów; `pnpm test` 96 plików / 522 testy zielone; `pnpm test:mobile` 10/10; `node scripts/test/lint-security.test.mjs` 15/15 ok. Testy zadania (`logs.content`, `participant-emails`, `session-cookie`) 3/3.

Kryteria:

- AC1 pass — test przechodzi przez rejestrację (w tym z zaproszeniem i z zajętym e-mailem), logowanie złe/dobre, listę, zmianę nazwy, pozycję z notatką, podgląd zaproszenia, WS, `GET /me|/lists|/lists/:id`, 400 i 500; znaczniki w imieniu, e-mailu, nazwie, notatce i komunikacie wyjątku. Mutacja `request.log.info(request.body)` w `POST /api/v1/lists` → `not to contain 'lista…'` (cofnięta).
- AC2 pass — 13 fixtures odrzuconych z właściwą regułą i identyfikatorem zagrożenia, 2 kontrole przechodzą. Usunięcie `...NO_DOM_HTML` z `SAFE_SYNTAX` → 5× FAIL, kod wyjścia 5 (cofnięte). Krok w CI w jobie `static` i w filtrze ścieżek.
- AC3 pass — uczestnik (Tomek) nie widzi e-maili Ani, Tomka ani Oli w podglądzie/przyjęciu zaproszenia, `POST items`, `GET /lists`, `GET /lists/:id` i dwóch `item.upserted`. Mutacja `name: user.email` w `membersOf` → `not to contain 'user-…'` (cofnięta).
- AC4 pass — rejestracja i logowanie na `https://lista.example`. Mutacje `defaultCookieAttributes: { httpOnly: false }` → `to match /HttpOnly/`, `{ sameSite: "strict" }` → `to match /SameSite=Lax/` (obie cofnięte). Usunięty test w `sign-up.test.ts` jest w całości pokryty nowym.
- AC5 pass — jak w reprodukcji.

Zadanie fix: „Root cause” wyjaśnia, czemu istniejące testy nie łapały regresji; testy reprodukujące padają bez zabezpieczenia (mutacje wyżej). Czerwone dowody w Evidence obecne (mutacje).

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | security / lint (TH-15) | Inne ujścia HTML w DOM nie są zakazane: `Object.assign(el, { innerHTML })`, `el.setHTMLUnsafe(…)`, `range.createContextualFragment(…)`, `el[\`innerHTML\`] =` (szablon). `document.write` łapie tylko `no-deprecated`. Dziś w repo brak użyć. | `eslint --stdin` na `AddBar.tsx`: brak błędu `no-restricted-syntax` dla tych wywołań | rozszerzyć `NO_DOM_HTML` i fixtures, jeśli projekt chce pełnego zakazu |
| 2 | minor | test / lint | Fixtures sprawdzają po jednym pliku na grupę (web AddBar, mobile, api, schema, shared). Nadpisania `no-restricted-syntax` dla `TermsScreen.tsx`, `useSession.ts`, `web-app.ts`, testów web i e2e ręcznie powtarzają `SAFE_SYNTAX`; zgubienie go w jednym nie zostanie wykryte. | `eslint.config.js` bloki z komentarzem „Nadpisanie … powtarza SAFE_SYNTAX” | fixture na każdy blok nadpisania albo test, że każda konfiguracja `no-restricted-syntax` zawiera wszystkie selektory `SAFE_SYNTAX` |
| 3 | note | test (TH-16/TH-21) | `logs.content.test.ts` nie dodaje do znaczników wartości ciasteczka sesji ani tokenu zaproszenia (TH-16 „token w logach”). Token zaproszenia ma osobny test (T-051), sesja nie. | przegląd testu | dopisać `session_token` i token zaproszenia do sprawdzanych wartości |
