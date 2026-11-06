---
id: T-105
title: "Dokumentacja po przeglądzie 3 E-02: jedna tabela błędów, listId w formacie błędu, backend.md, UAT.md i ślad AC"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-progress    # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given błędy wspólne, then opisuje je jedna tabela: druga odsyła do niej albo zawiera tylko kody specyficzne dla trasy. Żaden opis kodu nie jest powtórzony w dwóch miejscach. — verified by: przegląd QA
- [x] AC2: Given test zgodności dokumentacji, then sprawdza też (a) status HTTP z tabeli wobec `DOMAIN_STATUS` w `apps/api/src/http/api-error.ts` i (b) że każdy kod w kolumnie `code` tabeli jest w `ERROR_CODES`. Fixture albo ręczna zmiana statusu daje czerwony test (zapis w Evidence). — verified by: `pnpm vitest run --project shared error-codes-docs` (i test w `api`, jeśli porównanie z `DOMAIN_STATUS` wymaga importu z API)
- [x] AC3: Given format błędu w `architecture.md` i trasa przyjęcia zaproszenia w `api.md`, then `error.listId` jest opisane (kiedy występuje i co znaczy). — verified by: przegląd QA
- [x] AC4: Given `backend.md`, then `:105` i `:108` odsyłają do `bestEffort` / `afterCommit` zamiast „łapać i logować”, bez sprzeczności z `:106`. — verified by: przegląd QA
- [x] AC5: Given T-094 i T-095, then ich AC są odhaczone zgodnie z werdyktami QA. Given `epic.md` i `SC-06-lista.md`, then S-02-02 wymienia SC-06, a SC-06 ma F-13 w `requirements`. — verified by: `pnpm backlog-check`
- [x] AC6: Given `UAT.md`, then podaje aktualne statusy zadań naprawczych z przeglądów 2 i 3 (T-094–T-105) i odsyła do `docs/reviews/E-02-2026-11-06-1.md`. Ten krok robić jako ostatni, po T-103 i T-104. — verified by: przegląd QA
- [x] AC7: No regression in: `pnpm vitest run --project shared`, `pnpm backlog-check`, `pnpm format:check`.

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

T-095 dodał w `api.md` tabelę „Błędy wspólne” z pełnymi opisami kodów, choć `architecture.md` już miała tabelę błędów, więc kontrakt żył w dwóch miejscach i opisy (404) rozjechały się przy pierwszej zmianie. Test zgodności z T-095 sprawdzał tylko kierunek kod → dokument i samą obecność kodu, więc ani rozjazd opisów, ani status HTTP, ani kod w dokumencie spoza `ERROR_CODES` nie dawały czerwonego testu; pole `listId` (dodane do `ApiErrorBody` z SC-08) nie ma testu wcale, bo test nie czyta formatu błędu. `backend.md` dostał w T-098/T-101 regułę `bestEffort`/`logFailure`, ale starsze akapity T-087 i T-076 nie zostały przepisane. Ślad backlogu (UAT, AC, metadane) to ręczne kroki bez kontroli (klasa P6 z przeglądu 2).

Inne wystąpienia: innych powielonych tabel kodów w `docs/` nie ma (`grep "Błędy wspólne"`). Statusów kodów spoza domeny (`validation_failed`, `unauthenticated`, …) nadal nic nie sprawdza automatycznie — są rozsiane po `api-error.ts`, `auth-routes.ts` i Fastify, bez jednej mapy.

## Evidence

- **AC2 (b), czerwony przez mutację:** wiersz `| 418 | \`teapot\` | mutacja |` w tabeli `architecture.md` → `FAIL |shared| test/error-codes-docs.test.ts > … każdy kod w kolumnie \`code\` tabeli błędów jest w \`ERROR_CODES\` (T-105)`: `AssertionError: kody w tabeli błędów spoza \`ERROR_CODES\`: expected [ 'teapot' ] to deeply equal []`. Nawias przy kodzie (`(\`limit\`: \`lists\` …)`, `(\`requestId\`)`, `(\`listId\`)`) to pola, nie kody — pomijany.
- **AC2 (a), czerwony przez mutację:** `| 410 | \`invitation_invalid\`` → `| 409 |` → `FAIL |api| test/error-status-docs.test.ts > … \`invitation_invalid\`: tabela błędów podaje status z \`DOMAIN_STATUS\``: `expected [ 409 ] to deeply equal [ 410 ]`. Test w `api`, bo `DOMAIN_STATUS` (teraz eksportowane) żyje w `apps/api/src/http/api-error.ts`. Kod z kilkoma statusami (`validation_failed` 400/413/414/415) nie jest kodem domeny; parser i tak zbiera wszystkie statusy z komórki HTTP.
- Po przywróceniu dokumentów i zmianach: `pnpm vitest run --project shared error-codes-docs` 34/34, `pnpm vitest run --project api error-status-docs` 9/9.
- `pnpm check` (format, lint, typecheck, quality, design-check, backlog-check, workflow-check, test, test:mobile): exit 0, 155 plików, 1257 testów.
- AC1: `api.md` „Błędy wspólne” ma tylko kod i zakres (bez statusu i znaczenia) i odsyła do `architecture.md`; opisy z `api.md` (404 z uczestnikiem i linkiem, `invalid_origin` bez `Origin`, 401 poza publicznymi) przeniesione do tabeli `architecture.md`.
- AC3: format błędu w `architecture.md` z `listId` i `requestId` oraz zdaniem, przy jakich kodach występuje każde pole; `api.md` „Przyjmij” i akapit pod tabelą zaproszeń opisują `listId`.
- AC4: `backend.md` akapity T-087 i T-076 odsyłają do `bestEffort` / `afterCommit` (`logFailure`); akapit o dokumentach przekrojowych opisuje nowy test i `architecture.md` jako jedyne miejsce opisu kodu.
- AC5: AC T-094 i T-095 odhaczone (oba: ostatni werdykt QA `pass`, AC1–AC5 pass); `epic.md` S-02-02 `(F-13, SC-05, SC-06, SC-07)` jak `story.md`; `SC-06-lista.md` `requirements` z F-13. `pnpm backlog-check`: OK.
- AC6: `UAT.md` odsyła do przeglądu 3, podaje T-094–T-104 `done`, T-105 przez plik zadania, T-106 `todo`.

## Prevention

AC2 (test zgodności w obu kierunkach i ze statusem), propozycja z przeglądu zaakceptowana przez właściciela 2026-11-06.

<!-- QA rounds are appended below by /qa-task -->
