---
id: T-089
title: "Zdarzenia na żywo po zapisie: błąd rozesłania nie daje 500 w żadnej trasie; reguła lintu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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

<Do uzupełnienia przez implementującego. Ta sama przyczyna co T-076.>

## Evidence

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
