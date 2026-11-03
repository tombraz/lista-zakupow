---
id: T-081
title: "Dokumentacja architektury i API zgodna z kodem po E-02"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-074, T-076, T-078]
layers: [backend, web, db]
requirements: []
threats: []
screens: []
related_tasks: [T-053, T-054, T-056, T-060, T-061, T-062, T-064]
---

# T-081 Dokumentacja architektury i API zgodna z kodem po E-02

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, P7 i C12 (minor/note).

- **Actual:**
  - `docs/architecture/api.md:89`: `members.changed` ma wyzwalacze tylko „dołączenie, usunięcie, opuszczenie”. Kod wysyła to zdarzenie także po zmianie imienia i po usunięciu konta (`apps/api/src/modules/listy/http/person-events.ts`), a klient na nim polega (`apps/web/src/live/useLiveList.ts:116-120`).
  - `docs/architecture/data-model.md`: `name_key` opisany jako trim + NFC + lower (kod: NFKC + usuwanie ignorowalnych, `packages/shared/src/api/items.ts`). Brak tabel `data_migration` i `cleanup_run`. Brak reguły retencji `rate_limit` po najdłuższym oknie (P12).
  - `docs/architecture/layers/backend.md:92`: `summarize(error)` zamiast `errorSummary`. `backend.md:26`: `trusted-origin.ts` opisany jako „tylko `/api/v1/*`”, a po T-053/T-054 obejmuje też `/api/auth/*`.
  - `docs/architecture/architecture.md:56`: `konta` „zależy od `listy`”, a kod odwraca tę zależność przez `announceNameChanges` / `announceAccountDeletions`. `architecture.md:60` nie wymienia `closeUser` w `na-zywo`.
  - `docs/architecture/layers/web.md`: brak opisu mechanizmu komunikatu na SC-01 po końcu sesji (`EntryState` i `SESSION_END_KEY`).
  - `db.md` / ADR 0009: brak wyjątku dla surowych zapytań pg w krokach migracji danych (S13).
- **Expected:** dokumentacja opisuje kod tak, jak jest (po T-074, T-076 i T-078).

## Acceptance criteria

- [ ] AC1: Wszystkie punkty z listy „Actual” są poprawione w dokumentach; każda zmiana ma wpis w historii dokumentu, jeśli dokument ją prowadzi. — verified by: przegląd dokumentów
- [ ] AC2: `pnpm backlog-check` i `pnpm format:check` przechodzą.

## TDD plan

**Seam:** dokumenty (bez zmian kodu).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `pnpm format:check` | static | prettier | AC2 |

**Run:** `pnpm format:check && pnpm backlog-check`

## QA plan

- **Regression:** —
- **Edge cases:** porównać każdy zmieniony wiersz z kodem w HEAD.
- **Platforms:** —

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->
