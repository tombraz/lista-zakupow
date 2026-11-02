---
id: T-076
title: "PATCH /api/v1/me: błąd rozesłania zdarzeń nie zamienia zapisanego imienia w 500; 401 w api.md"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
