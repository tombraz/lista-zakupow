---
id: T-089
title: "Zdarzenia na żywo po zapisie: błąd rozesłania nie daje 500 w żadnej trasie; reguła lintu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa                 # todo | in-progress | in-qa | done | blocked
depends_on: [T-076]
layers: [backend]
requirements: [F-05, F-12, F-13, F-14]
threats: [TH-04]
screens: [SC-05, SC-06, SC-07]
related_tasks: [T-076, T-074, T-032]
---

# T-089 Zdarzenia na żywo po zapisie: błąd rozesłania nie daje 500 w żadnej trasie

## Report

Źródło: prewencja T-076 (zaakceptowana przez użytkownika 2026-11-04) i uwaga QA T-076 runda 1.

- **Actual:** trasy wołają rozesłanie zdarzeń na żywo (`live.publish`, `live.notify`, `announceAccessChanges`) po zatwierdzonym zapisie bez obsługi błędu. Wyjątek (baza w `peopleWithAccess`, hub) daje 500, choć zapis się udał; klient pokazuje błąd i użytkownik ponawia operację. Miejsca (gałąź `epic/E-02-konto-i-uczestnicy` @ a388203):
  - `listy/http/routes.ts:72` — utworzenie listy (`lists.changed`),
  - `listy/http/routes.ts:96-97` — zmiana nazwy listy (`list.updated`, `lists.changed`),
  - `listy/http/routes.ts:107` — usunięcie listy (`announceAccessChanges`),
  - `listy/http/routes.ts:163` — `withdrawAccess`: usunięcie i opuszczenie listy przez uczestnika,
  - `pozycje/http/item-events.ts:12-13` — zdarzenia pozycji,
  - `zaproszenia/http/invitation-events.ts:23-24` — przyjęcie zaproszenia (trasa i rejestracja z linku),
  - `zaproszenia/http/routes.ts:76` — `invitations.changed`.
- **Expected:** jak w T-076: odpowiedź oddaje wynik zapisu, błąd rozesłania trafia tylko do logu (`live_announce_failed`, `errorSummary`, bez nazw list, pozycji, imion i e-maili). Źródło: `layers/backend.md` „Pułapki” (wpis T-076), `T-076` AC1.
- **Steps to reproduce:**
  1. `buildTestApp(pool, { live })` z hubem, którego `publish` (albo `notify`) rzuca.
  2. `DELETE /api/v1/lists/:listId` jako właściciel → 500, a lista jest usunięta.
- **Environment:** lokalnie, API.

## Acceptance criteria

- [ ] AC1: Given hub, który zawodzi, when każda z tras z listy powyżej wykona zapis, then odpowiedź jest taka jak bez błędu (201/200/204), zapis jest w bazie, a log zawiera jeden wpis `live_announce_failed` bez danych osobowych. — verified by: testy integracyjne z zawodzącym hubem
- [ ] AC2: Jeden wspólny pomocnik „po zatwierdzeniu” w warstwie backend (przeniesiony `afterCommit` z `konta/http/me-routes.ts`) zamiast kopii w modułach; `me-routes.ts` też go używa. — verified by: przegląd kodu
- [ ] AC3: Reguła lintu (`no-restricted-syntax` w `eslint.config.*`) zabrania wołania `announceAccessChanges` i metod rozsyłających `live` w `apps/api/src/modules/*/http/**` poza pomocnikiem; nowe wywołanie bezpośrednie zawodzi `pnpm lint`. Jeśli reguły nie da się wyrazić selektorem bez fałszywych alarmów, implementujący zapisuje dlaczego i proponuje alternatywę (np. test architektury). — verified by: lint na celowo złym przykładzie
- [ ] AC4: Kolejność MC-03 (TH-04) bez zmian: `revoke` przed dalszym zdarzeniem listy. — verified by: istniejące `test/live.*.test.ts`
- [ ] AC5: No regression in: T-032, T-061, T-062, T-074, T-076 (zdarzenia na żywo przy listach, pozycjach, zaproszeniach, imieniu, usunięciu konta).

## TDD plan

**Seam:** trasy HTTP przez `buildTestApp(pool, { live })` z hubem, którego `publish`/`notify` rzuca; `captureLogs()`. Wzór: `apps/api/test/me.name.announce-failure.test.ts`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Usunięcie listy przy zawodzącym hubie: 204, lista usunięta, wpis w logu | integration | Vitest + Testcontainers | AC1 |
| 2 | Usunięcie i opuszczenie listy przez uczestnika: 204 | integration | Vitest + Testcontainers | AC1 |
| 3 | Przyjęcie zaproszenia (trasa i rejestracja z linku): wynik jak bez błędu | integration | Vitest + Testcontainers | AC1 |
| 4 | Utworzenie i zmiana nazwy listy, zdarzenia pozycji, `invitations.changed`: wynik jak bez błędu | integration | Vitest + Testcontainers | AC1 |
| 5 | Reguła lintu odrzuca bezpośrednie wywołanie w `http/` | static | ESLint | AC3 |

**Run:** `pnpm vitest run --project api announce-failure` i `pnpm lint`

## QA plan

- **Regression:** zdarzenia na żywo na SC-05, SC-06, SC-07 przy wszystkich operacjach z listy; kolejność `list.deleted` → `access.revoked` → `lists.changed`.
- **Edge cases:** błąd w `peopleWithAccess` (baza) zamiast w hubie — `test/failing-pool.ts`; błąd po części zdarzeń (np. `publish` przeszedł, `notify` rzuca).
- **Platforms:** API.

## Root cause

Ta sama przyczyna co T-076: od T-009 (zmiany na żywo, 35e0400; dalej T-032, T-058, T-059, T-074) trasy list, pozycji i zaproszeń wołały rozesłanie zdarzeń na żywo (`live.publish`/`notify`, `announceAccessChanges`, `peopleWithAccess`) wprost po zatwierdzonym zapisie, bez obsługi błędu, więc wyjątek z huba albo bazy szedł do globalnej obsługi błędów i dawał 500 przy zapisanej zmianie. Przy usunięciu uczestnika pomijał też zdarzenie `member_removed` w logu `security` (TH-21), a przy rejestracji z linku zamieniał założone konto w 500. Testy tego nie wykryły, bo każdy test tras używał działającego huba; pomocnik T-076 był prywatny w `me-routes.ts`, a nic nie wymuszało jego użycia.

Poprawka: `afterCommit(log, announce)` przeniesiony do `apps/api/src/http/after-commit.ts` (bierze `request.log`, więc działa też w rejestracji z linku: `InvitationOnSignUp` dostaje `log`); używają go `me-routes.ts`, `listy/http/routes.ts` (utworzenie, zmiana nazwy, usunięcie, `withdrawAccess`), `pozycje/http/item-events.ts` (wszystkie cztery trasy pozycji), `zaproszenia/http/invitation-events.ts` (trasa i rejestracja) i `zaproszenia/http/routes.ts` (unieważnienie). W `withdrawAccess` odczyt osób (obietnica podana do `announceAccessChanges`) ma `.catch`, żeby błąd huba przed jej odczytaniem nie zostawił nieobsłużonego odrzucenia. Kolejność MC-03 bez zmian (`announceAccessChanges` nietknięte). Reguła eslint `API_AFTER_COMMIT_SYNTAX` (`eslint.config.js`, pliki `apps/api/src/modules/*/http/**/*.ts`): `announceAccessChanges(…)` i `*.publish|notify|revoke(…)` tylko wewnątrz argumentu `afterCommit(…)`.

**Inne wystąpienia:** brak w `modules/*/http` (reguła lintu przechodzi na całym `apps/api/src`). `listy/index.ts` woła `announceAccessChanges` z funkcji podawanych do `konta` (`nameChanged`, `accountDeleting`) — te wywołuje `me-routes.ts` przez `afterCommit`, więc reguła ich nie obejmuje celowo (nie są trasą).

## Evidence

- Testy odtwarzające (przed poprawką wszystkie czerwone: `AssertionError: expected 500 to be 201|200|204`, 14 z 14):
  - `apps/api/test/lists.announce-failure.test.ts` — `POST /api/v1/lists`, `PATCH /api/v1/lists/:listId` (hub; tylko `notify` po udanym `publish`; błąd bazy w `peopleWithAccess` przez `failingPool`), `DELETE /api/v1/lists/:listId`, `DELETE …/members/:userId` (także `member_removed` w logu `security`), `POST …/leave`.
  - `apps/api/test/items.announce-failure.test.ts` — `POST …/items`, `PATCH …/items/:itemId`, `POST …/items/clear-checked`, `DELETE …/items/:itemId`.
  - `apps/api/test/invitations.announce-failure.test.ts` — `POST /api/v1/invitations/:token/accept`, rejestracja z `invitationToken`, `DELETE …/invitations/:invitationId`.
  - Każdy sprawdza status, zapis w bazie, dokładnie jeden wpis poziomu 50 `live_announce_failed` z `err.type` i brak w logu komunikatu błędu, nazw list i pozycji, imion i e-maili (`test/failing-live.ts` `expectOneAnnounceFailure`).
- Reguła lintu: `scripts/test/lint-security.test.mjs` — `live.notify`, `live.publish`, `live.revoke` i `announceAccessChanges` poza `afterCommit` w `listy/http/routes.ts` padają z komunikatem T-089; te same wywołania w `afterCommit` przechodzą.
- Po poprawce: `pnpm vitest run --project api announce-failure` — 4 pliki / 16 testów zielonych; `pnpm test` — 151 plików / 1181 testów zielonych (w tym `live.*.test.ts`: MC-03, T-032, T-061, T-062, T-074); `node scripts/test/lint-security.test.mjs` — 0 FAIL; `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm quality`, `pnpm backlog-check`, `pnpm build` bez błędów.

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
