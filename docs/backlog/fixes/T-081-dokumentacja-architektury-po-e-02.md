---
id: T-081
title: "Dokumentacja architektury i API zgodna z kodem po E-02"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
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

Zadania E-02 (T-053/T-054, T-060, T-061, T-062, T-064, T-074, T-078) zmieniały kod i aktualizowały głównie „Gdzie jest kod” i „Pułapki” w przewodnikach warstw, a nie opisy przekrojowe (`api.md`, `data-model.md`, tabela modułów w `architecture.md`, ADR). Nic tego nie sprawdza automatycznie: dokumenty nie mają testów zgodności z kodem, a QA tasków porównywał głównie zmienione pliki z AC. `data-model.md` i `api.md` nie mają historii zmian, więc brak aktualizacji nie był widoczny.

Inne wystąpienia: ADR 0004 opisywał starą regułę `name_key` (NFC) — dopisana notatka o aktualizacji zamiast zmiany decyzji.

## Evidence

Weryfikacja każdego punktu z kodem w HEAD (`154f907`):

- `members.changed`: `listy/domain/membership-events.ts` (`renameChanges`, `accountDeletionChanges`, `withdrawAccess`, przyjęcie zaproszenia), klient `web/src/live/useLiveList.ts:116-120` unieważnia `listKey` i `membersKey` → `api.md`.
- `name_key`: `packages/shared/src/api/items.ts:17-18` → `data-model.md`, notatka w ADR 0004.
- `data_migration`, `cleanup_run`: `apps/api/src/db/schema.ts:233-246` → `data-model.md` (słownik tabel, „Migracje”, „Sprzątanie”).
- Retencja `rate_limit`: `konta/infra/retention.ts:8-16` (`RATE_LIMIT_ROW_MS` = max okien, teraz `signUpPerIp` 1 h) → inwentarz w `data-model.md`.
- `errorSummary`: `src/logging.ts:186`, użycia w `api-error.ts` → `backend.md` „Pułapki”.
- `trusted-origin.ts`: `PUBLIC_AUTH_ROUTES` → `backend.md` „Gdzie jest kod”.
- Zależności modułów: `konta/index.ts` bez importu z `listy`; `listy/index.ts:76-83` rejestruje `announceNameChanges` / `announceAccountDeletions`; `na-zywo/domain/hub.ts:25` `closeUser` → `architecture.md`.
- SC-01: `session/useSession.ts` (`SESSION_END_KEY`, `useSessionEnd`), `session/guards.tsx` (`RequireSession`), `invitations/invitationContext.ts` (`EntryState`), `SC-01-logowanie/SignInScreen.tsx:23-24` → `web.md`.
- Surowe `pg`: `db/data-migrations/index.ts`, `0007-name-key-nfkc.ts` (`client.query` z `$n`, w tekście tylko stała `UNIQUE_KEY`) → `db.md`, ADR 0009.

Historia zmian dopisana w `architecture.md`, `backend.md`, `web.md`, `db.md` (`api.md` i `data-model.md` jej nie prowadzą).

`pnpm format:check` — All matched files use Prettier code style; `pnpm backlog-check` — OK: no errors.

## Prevention

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-04)

Verdict: pass

Zakres: commit `cc8f6b9` (tylko dokumenty: `api.md`, `architecture.md`, `data-model.md`, `layers/backend.md`, `layers/db.md`, `layers/web.md`, ADR 0004, ADR 0009). Każdy zmieniony wiersz porównany z kodem w HEAD (`297c88d`).

| # | Punkt „Actual” | Wynik | Dowód w kodzie |
| --- | --- | --- | --- |
| 1 | `members.changed` w `api.md` | pass | `listy/index.ts:76-83` (`renameChanges`, `accountDeletionChanges` przez `announceAccessChanges`), `membership-events.ts:56`; `useLiveList.ts:116-120` unieważnia `listKey` i `membersKey` |
| 2 | `name_key` w `data-model.md` + notatka ADR 0004 | pass | `packages/shared/src/api/items.ts:9,17-18` (trim, NFKC, `Default_Ignorable_Code_Point`, trim, lower pl-PL); krok `name: "0007_name_key_nfkc"` |
| 3 | tabele `data_migration`, `cleanup_run` | pass | `db/schema.ts:233-246` (`name` PK, `applied_at`; `id = 1` check, `started_at`) |
| 4 | retencja `rate_limit` | pass | `konta/infra/retention.ts:10-16`; `limits.ts`: max(60 s, 1 h, 60 s, 15 min) = 1 h |
| 5 | `errorSummary` w `backend.md` | pass | `logging.ts:186`, `api-error.ts:81,104` |
| 6 | `trusted-origin.ts` i `/api/auth/*` | pass | `http/trusted-origin.ts:8-11` (`PUBLIC_AUTH_ROUTES`) |
| 7 | zależności modułów, `closeUser` | pass | `konta/index.ts` nie importuje z `listy`; `listy/index.ts` woła `accounts.announce*`; `closeUser` w `konta/index.ts:64,93` i `me-routes.ts` |
| 8 | mechanizm komunikatu SC-01 w `web.md` | pass | `useSession.ts:9,26,61-63`; `guards.tsx:20`; `invitationContext.ts:14-22,53,58`; `SignInScreen.tsx:23-24`; `useNewPassword.ts:35` |
| 9 | wyjątek surowego `pg` w `db.md` / ADR 0009 | pass | `data-migrations/index.ts:16-29`, `0007-name-key-nfkc.ts:32,55` (w tekście tylko stała `UNIQUE_KEY`), `:64,78` z parametrami |

- AC1: pass. Historia zmian dopisana w `architecture.md`, `backend.md`, `db.md`, `web.md`; `api.md` i `data-model.md` historii nie prowadzą (sprawdzone grep). Pozostałe wzmianki o NFC (ADR 0004 §Decyzja, ADR 0009 o ręcznym powrocie do starego klucza) są poprawne historycznie.
- AC2: pass. `pnpm format:check` — „All matched files use Prettier code style!”; `pnpm backlog-check` — „OK: no errors” (uruchomione przez QA).
- Pełny zestaw testów, typecheck i lint nie uruchomione: commit nie zmienia kodu ani konfiguracji (`git show --stat` — tylko `docs/`).
- Root cause: wyjaśnia, dlaczego nic tego nie wychwyciło (brak testów zgodności dokumentów z kodem, brak historii w `api.md`/`data-model.md`). Test reprodukujący nie dotyczy (zmiana dokumentów).

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | proces | Sekcja „Prevention” pusta, choć Root cause wskazuje brak automatycznej kontroli zgodności dokumentów z kodem. | plik zadania, `## Prevention` | Wpis prewencji (np. jak w T-080: „Pułapki” + pomysł na kontrolę). |
| 2 | note | dokumentacja | Wiersz `konta` w tabeli modułów `architecture.md` jest długi; opis odwrócenia zależności mógłby trafić do akapitu pod tabelą. | `architecture.md:58` | — |
