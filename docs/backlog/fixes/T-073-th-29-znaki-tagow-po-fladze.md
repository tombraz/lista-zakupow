---
id: T-073
title: "TH-29: ukryty tekst ze znaków tagów po 🏴 przechodzi walidację nazw"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: high         # incident | high | normal | low
status: in-qa                 # todo | in-progress | in-qa | done | blocked
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
- **Expected:** znaki Cf są odrzucane; wyjątek dotyczy tylko U+200D i U+FE0F wewnątrz emoji. Źródło: `T-060-tekst-bez-znakow-sterujacych.md:40-41` (AC1, AC2), TH-29. Decyzja właściciela (2026-11-02, `docs/product/decisions.md`): z sekwencji tagów przechodzą tylko trzy flagi RGI (Anglia, Szkocja, Walia) jako dokładne ciągi. Zatwierdzone są też U+FE0E zaraz po emoji i U+FE0F w keycapie.
- **Steps to reproduce:**
  1. `requiredName(40).safeParse("Ania 🏴" + tagi)` zwraca `success: true`.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 7c3435f.

## Acceptance criteria

- [ ] AC1: Given nazwa z 🏴 i sekwencją tagów, która nie jest poprawną flagą regionu (np. tagi tekstu ASCII, brak U+E007F, więcej niż 6 tagów), when walidacja imienia, nazwy listy, nazwy pozycji lub notatki, then `invalid`. — verified by: test unit
- [ ] AC2: Given flaga Anglii, Szkocji albo Walii (🏴 + tagi `gbeng` / `gbsct` / `gbwls` + U+E007F, dokładny ciąg), when walidacja, then przechodzi; given każda inna sekwencja tagów (inne litery, np. `gbzzz`, brak U+E007F, tagi bez 🏴, dodatkowy tag po fladze), then `invalid`. Decyzja właściciela 2026-11-02 (`docs/product/decisions.md`). — verified by: test unit
- [ ] AC3: Given U+FE0E zaraz po emoji (❤︎) albo U+FE0F w keycapie (1️⃣), then przechodzi (zatwierdzone 2026-11-02); given dwa selektory wariantu z rzędu albo selektor bez emoji przed nim, then `invalid`. — verified by: test unit
- [ ] AC4: Given dowolny znak `\p{Cf}` spoza zatwierdzonej listy wstawiony w dowolne miejsce (także zaraz po emoji), then `invalid`. — verified by: test własności (fast-check albo pętla po zakresie)
- [ ] SEC1 (TH-29): Given `POST /api/v1/lists`, `POST …/items` albo `PATCH /api/v1/me` z ukrytymi tagami, then 400 `validation_failed`. — verified by: test integracyjny
- [ ] AC5: No regression in: emoji z T-060 (👨‍👩‍👧, 👩🏽‍🍳, 🏳️‍🌈, ❤️, 1️⃣).

## TDD plan

**Seam:** `requiredName` i schematy z `packages/shared`; API przez `buildTestApp`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | 🏴 + tagi ukrytego tekstu → invalid | unit | Vitest | AC1 |
| 2 | trzy flagi RGI przechodzą, inne sekwencje tagów → invalid; FE0E po emoji i FE0F w keycapie przechodzą | unit | Vitest | AC2, AC3 |
| 3 | każdy Cf spoza listy w każdej pozycji → invalid | unit | Vitest | AC4 |
| 4 | API: 400 dla tagów w nazwach | integration | Vitest + Testcontainers | SEC1 |

**Run:** `pnpm vitest run --project shared visible-text`; `pnpm vitest run --project api`

## QA plan

- **Regression:** T-060 (wszystkie AC), migracja `name_key` (T-060 AC5).
- **Edge cases:** U+E007F bez tagów, tagi bez 🏴, 🏴 na końcu nazwy, flaga + ZWJ.
- **Platforms:** web (komunikat „Usuń niewidoczne lub specjalne znaki.”).

## Root cause

Wzorzec wyjątku flag z T-060 (`712b035`, `packages/shared/src/api/text.ts:18`) usuwał przed sprawdzeniem każdy znak tagu poprzedzony przez 🏴 i dowolną liczbę tagów (`[\u{E0020}-\u{E007E}]*` w lookbehind), więc po 🏴 przechodził dowolnie długi niewidoczny tekst ASCII. Testy T-060 sprawdzały tylko, że poprawna flaga Szkocji przechodzi, a odrzucenie — wyłącznie dla wybranych znaków Cf w środku słowa; nie było testu „każdy Cf w każdym miejscu”, który objąłby sąsiedztwo wyjątków.

Poprawka: trzy flagi RGI jako dokładne ciągi; lookbehind ZWJ zawężony z `[\u{FE0F}\p{Emoji_Modifier}]*` do `\p{Emoji_Modifier}?\u{FE0F}?` (bez dowolnej liczby znaków, „Pułapki” w `backend.md`). Inne wystąpienia wzorca: brak (`grep` po `apps/` i `packages/`).

## Evidence

- **Red (przed poprawką):** `pnpm vitest run --project shared visible-text` — 63 testy padają, np. „name (sign-up): rejects hidden ASCII text after 🏴” (`AssertionError: expected undefined to be 'invalid'`) i test własności „rejects every format character in every place” (`expected [ 'U+E0020 right after 🏴', …(190) ] to deeply equal []`). `pnpm vitest run --project api visible-text.security` — 3 testy SEC1 padają (`expected 201 to be 400`, `expected 200 to be 400`).
- Sonda przed poprawką: poza tagami po 🏴 przechodził tylko U+FEFF na brzegu tekstu; `trim()` w JS usuwa go przed zapisem (to odstęp), więc test własności traktuje znak usunięty przez `trim()` jako niezapisany.
- AC3 (selektory wariantu) przechodziło już przed poprawką; testy zostają jako ochrona.
- **Green:** `shared` 379/379; `pnpm check`: format, lint, typecheck, quality, design-check, backlog-check, workflow-check zielone; `vitest run` 1105/1106 — jedyna porażka to znany niestabilny `apps/web/src/live/connection.test.tsx` › „SC-07: after a silent drop…” (zgłoszony w QA T-059 i T-062, plik nietknięty; 3 osobne przebiegi: 2× zielony, 1× czerwony). `pnpm test:mobile` 10/10, `pnpm build` zielony.
- **Regression:** T-060 (👨‍👩‍👧, 👩🏽‍🍳, 🏳️‍🌈, ❤️, 1️⃣, 🇵🇱, flaga Szkocji) — istniejące testy zielone; migracja `name_key` nie korzysta z tego wzorca.

## Prevention

Zaakceptowane przez właściciela 2026-11-02: test własności z AC4 zostaje na stałe w `packages/shared/test/` i obejmuje każdy wyjątek z `EMOJI_PART`; reguła zapisana w `backend.md`, „Pułapki” (dodana przy przeglądzie).

## Incident note

<!-- QA rounds are appended below by /qa-task -->
