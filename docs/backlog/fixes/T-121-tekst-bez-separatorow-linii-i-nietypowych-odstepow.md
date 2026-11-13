---
id: T-121
title: "Imiona, nazwy i notatki bez separatorów linii, nietypowych odstępów i pustych znaków"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: in-qa           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend, web]
requirements: [F-01, F-05, F-07, F-16]
threats: [TH-29, TH-36]
screens: []
related_tasks: [T-060, T-061]
---

# T-121 Imiona, nazwy i notatki bez separatorów linii, nietypowych odstępów i pustych znaków

## Report

Źródło: przegląd bezpieczeństwa `docs/security/reviews/E-02-2026-11-10-1.md`, znalezisko #4 (medium) i część #11 (low).

- **Actual:** `HIDDEN_CHARACTER` w `packages/shared/src/api/text.ts:9` obejmuje tylko `Cc`, `Cf` i `Default_Ignorable_Code_Point`. Jeśli tekst ma jakikolwiek widoczny znak, w imieniu (rejestracja, SC-09), nazwie listy, nazwie pozycji i notatce przechodzą:
  - separatory linii i akapitu U+2028 i U+2029 (wymuszają złamanie wiersza);
  - odstępy Zs inne niż U+0020 (U+3000, U+205F, U+1680, U+2000–U+200A);
  - U+2800, który `VISIBLE_CHARACTER` sam uznaje za niewidoczny.

  Przechodzą też Co, Cn i pojedyncze surogaty oraz dowolna liczba znaków łączących. Na lokalnym API imię i nazwa pozycji z U+2800 w środku dostały 200 / 201.
- **Expected:** odstęp w polach jednowierszowych to tylko U+0020, a w notatce dodatkowo `\n`. Znaki, które walidator uznaje za niewidoczne, są odrzucane wszędzie, nie tylko gdy tekst nie ma innych znaków. Źródło: T-060 AC1 („dla notatki dozwolone są tylko zwykłe spacje i (…) znak nowej linii”), TH-29.
- **Steps to reproduce:** przekazane właścicielowi poza repozytorium (repozytorium publiczne); dopisać tu po wydaniu poprawki.
- **Environment:** lokalnie, `cad0509`.
- **Evidence:** około 70 przypadków granicznych walidatora sprawdzonych w przeglądzie; `packages/shared/test/visible-text.test.ts` nie ma klas Zl, Zp ani Zs.

## Acceptance criteria

- [ ] AC1: Given imię albo nazwa (listy, pozycji) zawierające w środku U+2028, U+2029, odstęp Zs inny niż U+0020 albo U+2800, when trafiają na dowolną trasę zapisu, then API odpowiada 400 z kodem pola `invalid` i nic nie zapisuje. — verified by: `visible-text.test.ts` (tabela `FIELDS` × nowe klasy) i `visible-text.security.test.ts`
- [ ] AC2: Given notatka, when zawiera znak odstępu inny niż U+0020 i `\n` albo nie ma żadnego widocznego znaku po `trim`, then 400 `invalid`. — verified by: te same testy
- [ ] AC3: Given tekst z Co, Cn albo pojedynczym surogatem, when trafia na trasę zapisu, then 400 `invalid`. — verified by: te same testy
- [ ] AC4: Given grafem z więcej niż N znakami łączącymi (N do zatwierdzenia, np. 3), when trafia na trasę zapisu, then 400 `invalid`; polskie znaki, emoji z modyfikatorami i flagi RGI nadal przechodzą. — verified by: test jednostkowy walidatora
- [ ] AC5: Web pokazuje te same komunikaty błędów pól co dziś (Copy bez nowych tekstów albo nowe teksty w rejestrze Copy). — verified by: testy formularzy SC-02, SC-05, SC-06, SC-09
- [ ] AC6: No regression in: T-060, T-061, `name-key-migration.test.ts`, J-01, J-02, J-03.

## TDD plan

**Seam:** walidatory `packages/shared` i HTTP API

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `FIELDS` × {Zl, Zp, Zs ≠ U+0020, U+2800, Co, Cn, Cs} w środku tekstu | unit | Vitest | AC1–AC3 |
| 2 | limit znaków łączących na grafem | unit | Vitest | AC4 |
| 3 | 400 i brak wiersza dla każdej trasy | integracja | Vitest + Testcontainers | AC1–AC3 |

**Run:** `pnpm vitest run --project shared visible-text && pnpm vitest run --project api visible-text`

## QA plan

- **Regression:** rejestracja, zmiana imienia, tworzenie i zmiana nazwy listy, dodanie i edycja pozycji, blokada duplikatu F-09.
- **Edge cases:**
  - tabulator w notatce (dziś odrzucany jako Cc);
  - `\r\n` z wklejenia w notatce;
  - NBSP (U+00A0) z wklejenia z przeglądarki — decyzja właściciela 2026-11-13: zamienić na spację (przed `trim`), inne odstępy Zs odrzucać;
  - istniejące dane z takimi znakami (migracja ich nie zmienia, T-060 AC5).
- **Platforms:** API, web.

Decyzja właściciela 2026-11-13 (AC4): N = 3, liczone jako znaki łączące (`\p{M}`) z rzędu, bo nakładanie akcentów to zawsze ciąg; keycap 1️⃣ i rozłożony wietnamski mają ≤ 2.

## Root cause

T-060 i T-073 zdefiniowały „ukryty znak” listą kategorii Cc, Cf i Default_Ignorable; separatory Zl/Zp, odstępy Zs, U+2800, Co, Cn i Cs nie należą do żadnej z nich, a warunek „ma widoczny znak” łapał je tylko w tekście złożonym wyłącznie z nich. Notatka nie miała w ogóle warunku widocznego znaku. Testy nie złapały tego, bo tabela `FORBIDDEN` w `visible-text.test.ts` pokrywała tylko Cc i Cf (test własności T-073 przechodzi po wszystkich Cf, nie po wszystkich odstępach), a `INVISIBLE` sprawdzał U+2800 tylko jako cały tekst. Ten sam wzorzec nie występuje gdzie indziej: wszystkie pola tekstu widocznego dla innych idą przez `requiredName` / `optionalNote`.

## Evidence

- Red, `pnpm vitest run --project shared visible-text`: 100 failed / 342 passed, np. `name (sign-up): rejects Zl: line separator U+2028 inside the text` — `expected undefined to be 'invalid'`; NBSP — `expected { name: 'Ania K.' } …` (NBSP zostawała).
- Red, `pnpm vitest run --project api visible-text` (walidator sprzed poprawki): 5 nowych testów T-121 pada, np. `refuses to sign up with a name containing U+2028` — 200 zamiast 400.
- Green: `shared` 514/514, `api visible-text` 25/25; pełny zestaw 160 plików / 1403 testy, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` — bez błędów.

## Prevention

Hardening z przeglądu (#11, #12) poza tym zadaniem: zwijanie odstępów w kluczu duplikatu (nowy krok migracji danych), `unicode-bidi: isolate` dla treści innych osób w web.

## Incident note

<!-- QA rounds are appended below by /qa-task -->
