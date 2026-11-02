---
id: T-073
title: "TH-29: ukryty tekst ze znaków tagów po 🏴 przechodzi walidację nazw"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: high         # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend, web]
requirements: [F-05, F-07, F-16]
threats: [TH-29]
screens: [SC-02, SC-05, SC-06, SC-09]
related_tasks: [T-060]
---

# T-073 TH-29: ukryty tekst ze znaków tagów po 🏴 przechodzi walidację nazw

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, P1 (major). QA T-060 zgłosiło to wcześniej jako minor (`T-060:180`).

- **Actual:** wzorzec `(?<=\u{1F3F4}[\u{E0020}-\u{E007E}]*)[\u{E0020}-\u{E007F}]` (`packages/shared/src/api/text.ts:18`) przed sprawdzeniem usuwa dowolną liczbę znaków tagów po 🏴. Te znaki należą do kategorii Cf i są niewidoczne. Przykład: „Ania 🏴” z 11 tagami, które kodują „secret text”, przechodzi walidację (sprawdzone 2026-11-02 na skopiowanym wyrażeniu). Wyjątek obejmuje też U+FE0E i U+FE0F w keycapie, czego nikt nie zatwierdził.
- **Expected:** znaki Cf są odrzucane; wyjątek dotyczy tylko U+200D i U+FE0F wewnątrz emoji. Źródło: `T-060-tekst-bez-znakow-sterujacych.md:40-41` (AC1, AC2), TH-29. Jeśli flagi regionów mają przechodzić, to tylko jako poprawna sekwencja: 2–6 tagów liter lub cyfr zakończonych U+E007F. Wymaga to zatwierdzenia przez właściciela.
- **Steps to reproduce:**
  1. `requiredName(40).safeParse("Ania 🏴" + tagi)` zwraca `success: true`.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 7c3435f.

## Acceptance criteria

- [ ] AC1: Given nazwa z 🏴 i sekwencją tagów, która nie jest poprawną flagą regionu (np. tagi tekstu ASCII, brak U+E007F, więcej niż 6 tagów), when walidacja imienia, nazwy listy, nazwy pozycji lub notatki, then `invalid`. — verified by: test unit
- [ ] AC2: Given decyzja właściciela o flagach regionów (poprawna flaga, np. Szkocja, przechodzi albo wszystkie tagi są odrzucane), zapisana w `T-060` i `docs/product/decisions.md`, then walidacja działa zgodnie z nią. — verified by: test unit dla wybranej wersji
- [ ] AC3: Given U+FE0E albo U+FE0F poza zatwierdzonym wyjątkiem, then zachowanie zgodne z AC2 T-060 albo wyjątek zatwierdzony i zapisany. — verified by: test unit
- [ ] AC4: Given dowolny znak `\p{Cf}` spoza zatwierdzonej listy wstawiony w dowolne miejsce (także zaraz po emoji), then `invalid`. — verified by: test własności (fast-check albo pętla po zakresie)
- [ ] SEC1 (TH-29): Given `POST /api/v1/lists`, `POST …/items` albo `PATCH /api/v1/me` z ukrytymi tagami, then 400 `validation_failed`. — verified by: test integracyjny
- [ ] AC5: No regression in: emoji z T-060 (👨‍👩‍👧, 👩🏽‍🍳, 🏳️‍🌈, ❤️, 1️⃣).

## TDD plan

**Seam:** `requiredName` i schematy z `packages/shared`; API przez `buildTestApp`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | 🏴 + tagi ukrytego tekstu → invalid | unit | Vitest | AC1 |
| 2 | flaga regionu zgodnie z decyzją właściciela | unit | Vitest | AC2, AC3 |
| 3 | każdy Cf spoza listy w każdej pozycji → invalid | unit | Vitest | AC4 |
| 4 | API: 400 dla tagów w nazwach | integration | Vitest + Testcontainers | SEC1 |

**Run:** `pnpm vitest run --project shared visible-text`; `pnpm vitest run --project api`

## QA plan

- **Regression:** T-060 (wszystkie AC), migracja `name_key` (T-060 AC5).
- **Edge cases:** U+E007F bez tagów, tagi bez 🏴, 🏴 na końcu nazwy, flaga + ZWJ.
- **Platforms:** web (komunikat „Usuń niewidoczne lub specjalne znaki.”).

## Root cause

<Do uzupełnienia przez implementującego.>

## Evidence

## Prevention

Zaakceptowane przez właściciela 2026-11-02: test własności z AC4 zostaje na stałe w `packages/shared/test/` i obejmuje każdy wyjątek z `EMOJI_PART`; reguła zapisana w `backend.md`, „Pułapki” (dodana przy przeglądzie).

## Incident note

<!-- QA rounds are appended below by /qa-task -->
