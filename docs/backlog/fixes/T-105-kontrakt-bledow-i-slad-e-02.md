---
id: T-105
title: "Dokumentacja po przeglądzie 3 E-02: jedna tabela błędów, listId w formacie błędu, backend.md, UAT.md i ślad AC"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-103, T-104]
layers: [backend]
requirements: [F-13]
threats: []
screens: [SC-06]
related_tasks: [T-095, T-098, T-094, T-096]
---

# T-105 Dokumentacja po przeglądzie 3 E-02: jedna tabela błędów, listId w formacie błędu, backend.md, UAT.md i ślad AC

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-06-1.md`: K1, K2, K5 (spójność) oraz P2, P3, P4 (spec), wszystkie minor. Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:**
  - **K1:** T-095 dodał w `docs/architecture/api.md:10-21` drugą tabelę błędów („Błędy wspólne”) obok tabeli w `docs/architecture/architecture.md`, a opisy już się różnią (404: `architecture.md:115` mówi „lista lub pozycja”, `api.md` mówi „lista, pozycja, uczestnik lub link…”). `packages/shared/test/error-codes-docs.test.ts` sprawdza tylko obecność kodu (kod → dokument), nie status HTTP ani kierunek dokument → kod.
  - **K2:** pole `error.listId` (`packages/shared/src/api/errors.ts:45`, `apps/api/src/http/api-error.ts:35-40`) przy `own_list` i `already_member` nie jest opisane w formacie błędu ani w `api.md`. Kontrakt przeczyta klient mobilny (E-04).
  - **K5:** `docs/architecture/layers/backend.md:106` mówi „nie pisać własnego try/catch, tylko `bestEffort`/`logFailure`”, a `:105` i `:108` nadal każą „łapać i logować (`errorSummary`…)”.
  - **P2:** `docs/backlog/E-02-konto-i-uczestnicy/UAT.md:3`, `:31` podaje T-097–T-099 jako `todo`, nie wymienia T-100–T-105 i odsyła do przeglądu 2 jako ostatniego.
  - **P3:** T-094 i T-095 mają `status: done` i QA `pass`, ale nieodhaczone AC (`T-094…md:34-38`, `T-095…md:33-37`).
  - **P4:** po T-094 SC-06 realizuje część F-13, ale `epic.md:30` przypisuje S-02-02 tylko SC-07, a front-matter `docs/design/screens/SC-06-lista.md:4` nie ma F-13.
- **Expected:** kontrakt w dokumentacji jest jeden i zgodny z kodem w obu kierunkach (`backend.md:109`, C1 z przeglądu 2). Reguły w przewodniku warstwy nie są sprzeczne. Ślad backlogu (UAT, AC, metadane) odpowiada stanowi kodu.
- **Environment:** commit `120e478`.
- **Evidence:** `docs/reviews/E-02-2026-11-06-1.md`.

## Acceptance criteria

- [ ] AC1: Given błędy wspólne, then opisuje je jedna tabela: druga odsyła do niej albo zawiera tylko kody specyficzne dla trasy. Żaden opis kodu nie jest powtórzony w dwóch miejscach. — verified by: przegląd QA
- [ ] AC2: Given test zgodności dokumentacji, then sprawdza też (a) status HTTP z tabeli wobec `DOMAIN_STATUS` w `apps/api/src/http/api-error.ts` i (b) że każdy kod w kolumnie `code` tabeli jest w `ERROR_CODES`. Fixture albo ręczna zmiana statusu daje czerwony test (zapis w Evidence). — verified by: `pnpm vitest run --project shared error-codes-docs` (i test w `api`, jeśli porównanie z `DOMAIN_STATUS` wymaga importu z API)
- [ ] AC3: Given format błędu w `architecture.md` i trasa przyjęcia zaproszenia w `api.md`, then `error.listId` jest opisane (kiedy występuje i co znaczy). — verified by: przegląd QA
- [ ] AC4: Given `backend.md`, then `:105` i `:108` odsyłają do `bestEffort` / `afterCommit` zamiast „łapać i logować”, bez sprzeczności z `:106`. — verified by: przegląd QA
- [ ] AC5: Given T-094 i T-095, then ich AC są odhaczone zgodnie z werdyktami QA. Given `epic.md` i `SC-06-lista.md`, then S-02-02 wymienia SC-06, a SC-06 ma F-13 w `requirements`. — verified by: `pnpm backlog-check`
- [ ] AC6: Given `UAT.md`, then podaje aktualne statusy zadań naprawczych z przeglądów 2 i 3 (T-094–T-105) i odsyła do `docs/reviews/E-02-2026-11-06-1.md`. Ten krok robić jako ostatni, po T-103 i T-104. — verified by: przegląd QA
- [ ] AC7: No regression in: `pnpm vitest run --project shared`, `pnpm backlog-check`, `pnpm format:check`.

## TDD plan

**Seam:** test zgodności dokumentacji `packages/shared/test/error-codes-docs.test.ts`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | kod w tabeli spoza `ERROR_CODES` → czerwony | unit | Vitest | AC2 (b) |
| 2 | status w tabeli różny od `DOMAIN_STATUS` → czerwony | unit | Vitest | AC2 (a) |

**Run:** `pnpm vitest run --project shared --project api`

## QA plan

- **Regression:** istniejące 33 testy zgodności dokumentacji; `backlog-check`.
- **Edge cases:** kod z kilkoma statusami (`validation_failed` 400/413/414/415).
- **Platforms:** —

## Root cause

<Uzupełnia /fix.>

## Evidence

<Uzupełnia /fix.>

## Prevention

AC2 (test zgodności w obu kierunkach i ze statusem), propozycja z przeglądu zaakceptowana przez właściciela 2026-11-06.

<!-- QA rounds are appended below by /qa-task -->
