---
id: T-076
title: "PATCH /api/v1/me: błąd rozesłania zdarzeń nie zamienia zapisanego imienia w 500; 401 w api.md"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-16]
threats: []
screens: [SC-09]
related_tasks: [T-061]
---

# T-076 PATCH /api/v1/me: błąd rozesłania zdarzeń nie zamienia zapisanego imienia w 500

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, P4 i S11 (minor).

- **Actual:** w `apps/api/src/modules/konta/http/me-routes.ts:40-44` po zatwierdzonym `UPDATE` wywoływane jest `await nameChanged(user.id)`. Błąd w tym miejscu, np. bazy przy `listsOf`, daje 500. Klient pokazuje wtedy „Nie udało się zapisać. Spróbuj ponownie.”, choć imię jest już zapisane. Trasa zwraca też 401 (konto usunięte w międzyczasie), czego `docs/architecture/api.md:30` nie opisuje.
- **Expected:** odpowiedź odzwierciedla wynik zapisu. Błąd rozesłania zdarzeń trafia tylko do logu (`errorSummary`), tak jak mail resetu w `konta/index.ts:68-73`. `api.md` wymienia 401. Źródło: `T-061-zmiana-imienia.md:43` (AC4); `backend.md` (zdarzenia po zatwierdzeniu).
- **Steps to reproduce:**
  1. Podstaw `nameChanged`, które rzuca błąd.
  2. `PATCH /api/v1/me` z poprawnym imieniem zwraca 500, a imię w bazie jest zmienione.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 7c3435f.

## Acceptance criteria

- [ ] AC1: Given rozesłanie zdarzeń kończy się błędem po zapisie, when `PATCH /api/v1/me`, then 200 z nowym imieniem, a log zawiera błąd z `errorSummary` (bez imienia i e-maila). — verified by: test integracyjny
- [ ] AC2: `api.md` w wierszu „Zmiana imienia” wymienia błędy 400 i 401. — verified by: przegląd dokumentu
- [ ] AC3: No regression in: T-061 (zdarzenia na żywo po zmianie imienia).

## TDD plan

**Seam:** `PATCH /api/v1/me` przez `buildTestApp` z podstawionym rozesłaniem; `captureLogs()`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Błąd rozesłania: 200 i wpis w logu | integration | Vitest + Testcontainers | AC1 |

**Run:** `pnpm vitest run --project api me`

## QA plan

- **Regression:** zmiana imienia na SC-09, odświeżenie SC-05, SC-06 i SC-07 u innych osób.
- **Edge cases:** konto usunięte między sprawdzeniem sesji a zapisem (401).
- **Platforms:** API.

## Root cause

T-061 (cc6cfda) dodał `await nameChanged(user.id)` po zatwierdzonym `UPDATE` bez obsługi błędu, więc wyjątek z rozesłania (baza w `listsWithPeopleOf`, hub na żywo) szedł do globalnej obsługi błędów i dawał 500, choć zapis już się udał. Ten sam wzorzec był w `DELETE /api/v1/me` (`await announce()`), gdzie wyjątek pomijał dodatkowo `closeUser` (TH-17: połączenia na żywo usuniętego konta zostawały otwarte). Testy go nie wykryły, bo każdy test tras `me` używał prawdziwego, działającego huba; żaden nie podstawiał rozesłania, które zawodzi.

Poprawka: `afterCommit` w `me-routes.ts` łapie błąd rozesłania i loguje `live_announce_failed` z `errorSummary` (typ i stos, bez komunikatu, imienia i e-maila); odpowiedź odzwierciedla zapis. `api.md`: wiersz „Zmiana imienia” wymienia 400 i 401.

**Inne wystąpienia (ta sama przyczyna, inny moduł; nie naprawione tutaj):** `await announceAccessChanges(...)` po zatwierdzeniu w `listy/http/routes.ts:107` (usunięcie listy), `listy/http/routes.ts:163` (usunięcie/opuszczenie przez uczestnika) i `zaproszenia/http/invitation-events.ts:24` (przyjęcie zaproszenia). Propozycja: osobne zadanie przez `/plan-backlog` — wspólny pomocnik „po zatwierdzeniu” zamiast kopii w każdym module.

## Evidence

- Test odtwarzający: `apps/api/test/me.name.announce-failure.test.ts`
  - „answers 200 with the new name and logs the failure without the name or the e-mail” — przed poprawką: `AssertionError: expected 500 to be 200`.
  - „answers 204 to DELETE /api/v1/me and still closes the account's live connections” — przed poprawką: `AssertionError: expected 500 to be 204`.
- Po poprawce: oba zielone; `pnpm test` 148 plików / 1167 testów zielonych; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` bez błędów.

## Prevention

**Co by temu zapobiegło:** jeden wspólny pomocnik „zdarzenia po zatwierdzeniu” (łapie błąd, loguje `errorSummary`) używany przez każdą trasę rozsyłającą zdarzenia na żywo, plus test z hubem, który zawodzi, dla każdej takiej trasy (seam: `buildTestApp({ live })`). Te same przyczyny są jeszcze w `listy/http/routes.ts:107`, `:163` i `zaproszenia/http/invitation-events.ts:24`.

Propozycje dla użytkownika (w kolejności preferencji):
1. Zadanie przez `/plan-backlog`: wspólny pomocnik w warstwie backend + testy z zawodzącym hubem dla trzech pozostałych tras; ewentualnie reguła lintu (`no-restricted-syntax`) zabraniająca `await announceAccessChanges(` poza pomocnikiem.
2. Wpis w „Pitfalls” w `docs/architecture/layers/backend.md`: „Zdarzenia po zatwierdzeniu nie mogą zmienić wyniku zapisu — błąd tylko do logu, kolejne kroki (np. `closeUser`) muszą się wykonać.”

Decyzja użytkownika: _oczekuje_.

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-04)

Verdict: pass

Zakres: commit 63a2a5e (`me-routes.ts`, `test/me.name.announce-failure.test.ts`, `api.md`).

Odtworzenie: `pnpm install --frozen-lockfile` bez zmian; `pnpm vitest run --project api me` — 17 plików / 52 testy zielone; `pnpm test` — 148 plików / 1167 testów zielonych; `pnpm typecheck`, `pnpm lint`, `pnpm format:check` bez błędów.

Kryteria:

- AC1 **pass** — test „answers 200 with the new name…” sprawdza 200, treść odpowiedzi, imię w bazie (`GET /api/v1/me`), dokładnie jeden wpis poziomu 50 `live_announce_failed` z `err.type` i brak imienia (starego i nowego), e-maila i komunikatu błędu w całym logu.
- AC2 **pass** — `api.md:31` wymienia `400, 401 (konto usunięte w międzyczasie)`.
- AC3 **pass** — testy T-061 (`me.name*.test.ts`, `live.name.test.ts`, `logs.content.test.ts`, `visible-text.security.test.ts`) zielone w pełnym przebiegu.

Spot-check: usunięcie `try/catch` w `afterCommit` → oba testy pliku czerwone (`expected 500 to be 200`, `expected 500 to be 204`), zgodnie z czerwonym dowodem w „Evidence”. Przywrócone, `git status` czysty. „Root cause” wyjaśnia, czemu testy nie wykryły błędu (zawsze działający hub).

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | Testy | Ścieżka 401 w `PATCH /api/v1/me` (konto usunięte między `requireUser` a `renameUser`) nie ma testu; zadanie tylko ją dokumentuje. | `grep` w `apps/api/test/me*.ts` — brak przypadku `renameUser` → `null` | Test integracyjny: konto usunięte po sprawdzeniu sesji → 401, brak zdarzeń. |
| 2 | minor | Testy | Test `DELETE` sprawdza tylko liczbę wpisów błędu (`toHaveLength(1)`), nie `event` ani brak danych osobowych. | `me.name.announce-failure.test.ts:57` | Asercja `event: "live_announce_failed"` jak w teście PATCH. |
| 3 | note | Architektura | Ten sam wzorzec (`await announceAccessChanges` po zatwierdzeniu bez obsługi błędu) zostaje w `listy/http/routes.ts:107`, `:163` i `zaproszenia/http/invitation-events.ts:24`; `afterCommit` jest prywatny w `me-routes.ts`. | „Root cause”, „Inne wystąpienia” | Osobne zadanie: wspólny pomocnik „po zatwierdzeniu” we wszystkich modułach. |
| 4 | note | Dokumentacja | Sekcja „Prevention” pusta. | plik zadania | Propozycja reguły lub testu zapobiegającego (np. wspólny pomocnik + test z zawodzącym hubem dla każdej trasy publikującej). |
