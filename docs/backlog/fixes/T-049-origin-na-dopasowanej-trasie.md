---
id: T-049
title: "Sprawdzenie Origin obejmuje każde żądanie zmieniające stan w /api/v1"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: high         # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given żądanie POST, PATCH lub DELETE, które router kieruje do trasy `/api/v1/*`, when brak `Origin` albo `Origin` obcy, then 403 `invalid_origin` i baza bez zmian, także dla wariantów zapisu ścieżki z raportu. — verified by: test integracyjny wariantów ścieżki w `origin.test.ts`
- [x] AC2: Given te same warianty ścieżki dla `/api/auth/*`, when obcy Origin, then odmowa (403) zamiast 500, a sesja ani konto nie powstaje. — verified by: test integracyjny
- [x] AC3: Decyzja w hooku opiera się na dopasowanej trasie (`request.routeOptions.url`) albo obejmuje każdą metodę zmieniającą stan. `backend.md` ma regułę z TH-26. — verified by: przegląd kodu w QA
- [x] AC4: No regression in: J-01–J-05, `origin.test.ts`, `live.upgrade.test.ts`, E2E.

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

Hook `trustedOrigin` (T-005, `9fc8fd1`) wybierał żądania do sprawdzenia po prefiksie surowego `request.url`, a router Fastify (find-my-way) dopasowuje trasę po zdekodowanej ścieżce, więc zapis z zakodowanymi literami (np. `%76` zamiast `v`) trafia do trasy `/api/v1/*`, ale omija kontrolę. Ten sam rozjazd jest w moście Better Auth (T-004, `dbca17a`): `forward()` budował adres z surowego `request.url`, Better Auth nie znajdował ścieżki, a `relay()` mapował jego 404 na 500 zamiast sprawdzić `Origin`. Testy `origin.test.ts` używały tylko kanonicznych ścieżek, a TH-26 dopisano do modelu zagrożeń dopiero w przeglądzie E-01.

**Inne wystąpienia wzorca (surowy `request.url`):**
- `apps/api/src/logging.ts` `redactedUrl` — redakcja tokenu zaproszenia po prefiksie surowej ścieżki; wariant zapisu zostawia token w logu. Ryzyko niskie (token pochodzi od samego żądającego, klient web używa kanonicznej ścieżki), ale to ten sam rozjazd TH-26 w innym miejscu → osobne zadanie (propozycja niżej), nie w tej poprawce.
- `apps/api/src/http/web-app.ts` `API_PATH` — tylko wybór odpowiedzi 404 (JSON czy SPA) dla nieznanej trasy; nie jest decyzją bezpieczeństwa.

## Evidence

- Red (przed poprawką), `pnpm vitest run --project api origin`:
  - `rejects state-changing requests to /api/v1 routes without a trusted Origin, whatever the path spelling` — `expected status 403, received 201` (POST `/api/v1/lists` w wariancie zapisu, obcy `Origin`).
  - `rejects auth requests with a foreign Origin on path variants without a 500` — `expected 403, received 500`.
  - `keeps safe methods free of the Origin rule and unknown routes at 404` — `expected 404, received 403` (nieznana trasa pod prefiksem).
- Green: `origin.test.ts` 6/6; pełny `pnpm test` 93 plików / 520 testów; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` bez błędów; `pnpm test:e2e` 50/50.
- Poprawka: `trusted-origin.ts` decyduje na `request.routeOptions.url`; `forward()` w `auth-routes.ts` przekazuje Better Auth wzorzec dopasowanej trasy. `backend.md` „Zasady bezpieczeństwa” ma regułę TH-26.
- Steps to reproduce są teraz w teście (`spellings()` w `origin.test.ts`), bo poprawka wychodzi razem z nim.

## Prevention

Propozycja z przeglądu: reguła w `backend.md` „decyzje bezpieczeństwa na `routeOptions.url`, nie na prefiksie `request.url`” oraz reguła lintu zakazująca `request.url.startsWith` w `apps/api/src/http/**` (TH-26). Sprawdzić też `redactedUrl` w `apps/api/src/logging.ts`.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-31)

Verdict: pass

Zakres: commit `7608de5` (`trusted-origin.ts`, `auth-routes.ts` `forward()`, `origin.test.ts`, `backend.md`). Spot-checki i testy eksploracyjne w odłączonym worktree na `7608de5`, bo w głównym katalogu w trakcie QA pojawiały się niezacommitowane zmiany innego procesu (lint `API_RAW_URL_SYNTAX`, T-051).

**Reprodukcja:** `pnpm vitest run --project api origin` 6/6; `pnpm test` 93 plików / 520 testów zielonych; `pnpm typecheck`, `pnpm lint`, `pnpm format:check` bez błędów (na `7608de5`); `pnpm build` + `pnpm test:e2e` 50/50.

**Kryteria akceptacji:**
- AC1 pass: test 1 sprawdza POST/PATCH/DELETE na 6 trasach list, pozycji i zaproszeń × 5 zapisów ścieżki × (obcy / brak `Origin`) → 403 `invalid_origin`, potem stan bazy (1 lista „Dom”, 1 pozycja, 0 zaproszeń). Ręcznie: `PUT`, `#fragment`, `;x`, `%2F`, `%2561`, `//`, `/API/` → 403 albo 404, nigdy 2xx.
- AC2 pass: warianty `/api/%61uth/…` i `/%61pi/auth/…` z obcym `Origin` → 403, bez ciasteczka, sesji i konta. Ręcznie: wariant `sign-out` z obcym `Origin` → 403.
- AC3 pass: hook decyduje na `request.routeOptions.url`; most Better Auth przekazuje wzorzec trasy; `backend.md` „Zasady bezpieczeństwa” ma regułę TH-26.
- AC4 pass: pełny zestaw testów, `origin.test.ts`, `live.upgrade.test.ts`, E2E (J-01–J-05) zielone.

**Spot-checki (fix task):** przywrócenie `request.url.startsWith` w hooku → testy 1 i 3 czerwone (`expected 403 to be 404`, wariant ścieżki 2xx); przywrócenie `new URL(request.url, origin)` w `forward()` → test 2 czerwony. Oba testy gryzą. Sekcja „Root cause” wyjaśnia, czemu testy nie złapały błędu (tylko kanoniczne ścieżki). Dowody red w Evidence obecne dla obu planowanych testów.

**Eksploracja:** zaufany `Origin` na wariancie (`/api/%761/lists`, `?x=1`, `/api/%61uth/sign-in/email`) → 201/200, czyli brak regresji; nieznana trasa pod prefiksem (`/api/v1/nope`, `/api/%761/nope`) → 404; GET na wariancie → 200 bez `Origin`.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | testy | Test AC2 nie obejmuje wariantu ścieżki dla `sign-out` (jedyna trasa `/api/auth/*` z ciasteczkiem, więc najbardziej istotna dla CSRF). Zachowanie poprawne. | ręcznie: `POST /%61pi/auth/sign-out` z obcym `Origin` i ciasteczkiem → 403 | wariant `sign-out` w teście 2 |
| 2 | note | kod | `forward()`: fallback `?? request.url` jest martwy (handler wywołuje się tylko na dopasowanej trasie) i zostawia surowy adres w kodzie. | `auth-routes.ts:133` | usunąć fallback (niezacommitowana prewencja z lintem `API_RAW_URL_SYNTAX` to robi) |
| 3 | note | zachowanie | `PATCH`/`DELETE /api/v1/lists/` (pusty `:listId`) daje 403 przy obcym `Origin`, a 404 przy zaufanym; to zgodne z regułą „dopasowana trasa”, nie wyciek. | eksploracja | bez zmian |
| 4 | note | proces | W trakcie QA inny proces zmieniał drzewo robocze (bez commitu). Przywracając plik po własnym spot-checku, QA cofnęło niezacommitowaną zmianę w `auth-routes.ts` (usunięcie fallbacku `?? request.url`). Teraz `eslint` z nową regułą `API_RAW_URL_SYNTAX` zgłasza `auth-routes.ts:133`. | `npx eslint apps/api/src/modules/konta/http/auth-routes.ts` → 1 błąd | autor prewencji ponawia tę jedną zmianę |
