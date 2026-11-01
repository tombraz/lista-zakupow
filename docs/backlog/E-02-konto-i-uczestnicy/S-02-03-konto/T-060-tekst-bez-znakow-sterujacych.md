---
id: T-060
title: "Tekst widoczny dla innych bez znaków sterujących i bidi; duplikat po NFKC"
epic: E-02
story: S-02-03
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: []
size: M                # S | M (L must be split)
layers: [backend, db, web]
requirements: [F-01, F-05, F-07, F-09, F-16]
threats: [TH-29]
screens: [SC-02, SC-05, SC-06]
---

# T-060 Tekst widoczny dla innych bez znaków sterujących i bidi; duplikat po NFKC

## Goal

Imię, nazwy list i pozycji oraz notatki nie mogą zawierać znaków sterujących (Cc), formatujących (Cf) ani znaków zmiany kierunku tekstu i muszą mieć co najmniej jeden widoczny znak — jedna reguła dla API, web i (później) mobile. Blokada duplikatu (F-09) traktuje „Mleko” z niewidocznym znakiem lub w innej postaci Unicode jak „Mleko”; istniejące dane są przeliczone migracją.

## Demo

1. SC-06: dodaj „Mleko”, potem „Mleko” z dopisanym znakiem zero-width (wklejonym) → „„Mleko” jest już na liście…”.
2. SC-06: dodaj „ﬁlet” (ligatura) przy istniejącym „filet” → duplikat.
3. SC-02 / SC-05: imię albo nazwa listy ze znakiem RLO (U+202E) → komunikat przy polu, zapis się nie udaje.

## Context

- BRD: F-09 — „duplikat bez rozróżniania wielkości liter”; F-01, F-05, F-07, F-16 — długości imienia i nazw.
- Architektura: TH-29 (`threat-model.md`: „odrzucanie Cc/Cf i znaków bidi, wymóg widocznego znaku; NFKC i usuwanie znaków ignorowalnych w normalizacji duplikatu”; przegląd bezpieczeństwa E-01, #7 rundy 1), `data-model.md` (`name_key`: dziś `trim` + NFC + `toLocaleLowerCase('pl-PL')`, `UNIQUE (list_id, name_key)`; migracje tylko do przodu).
- Existing code: `packages/shared/src/api/text.ts` (`requiredName`, `withoutNul`), `packages/shared/src/api/items.ts` (`normalizeItemName`), schematy rejestracji, list i pozycji; komunikaty błędów pól w web (`errorText.ts`, `messages.ts` ekranów).
- Design: komunikat przy polu dla nowego błędu nie istnieje w specyfikacjach ekranów — copy w AC4 zatwierdzone przez właściciela 2026-11-01; reguła emoji (AC2) też.
- Depends on: — .

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given tekst ze znakiem z kategorii Cc (poza NUL — już odrzucany), Cf (np. U+200B, U+200D, U+FEFF, U+2060) albo bidi (U+202A–U+202E, U+2066–U+2069, U+200E, U+200F, U+061C), when walidacja imienia, nazwy listy, nazwy pozycji lub notatki, then błąd `invalid`; dla notatki dozwolone są tylko zwykłe spacje i (jeśli notatka je dziś przyjmuje) znak nowej linii. — verified by: testy unit dla każdej klasy znaków
- [ ] AC2: Given tekst złożony tylko ze znaków niewidocznych (np. U+3164, U+2800, same znaki łączące), when walidacja pola wymaganego, then błąd `invalid` (wymóg widocznego znaku). Wyjątek od AC1: U+200D (ZWJ) i selektor wariantu U+FE0F są dozwolone tylko wewnątrz sekwencji emoji (między znakami `Extended_Pictographic`), więc „Rodzina 👨‍👩‍👧” i „🥛” przechodzą, a „Mleko‍” nie. — verified by: testy unit
- [ ] AC3: Given `normalizeItemName`, then klucz = `trim` + NFKC + usunięcie znaków `Default_Ignorable_Code_Point` + `toLocaleLowerCase('pl-PL')`; „Mleko”, „MLEKO”, „ｍｌｅｋｏ” i „ﬁlet”/„filet” dają ten sam klucz co odpowiednik. Given API `POST …/items` z takim wariantem, then 409 `duplicate_item`. — verified by: testy unit + test integracyjny
- [ ] AC4: Given web (SC-02 imię, SC-05 nazwa listy, SC-06 nazwa i notatka pozycji), when API zwraca `invalid` dla pola, then pod polem komunikat „Usuń niewidoczne lub specjalne znaki.” (copy zatwierdzone przez właściciela 2026-11-01 — dopisać do Copy SC-02, SC-05, SC-06), powiązany z polem (`aria-describedby`), fokus na polu. — verified by: testy komponentów (MSW)
- [ ] AC5: Given istniejące pozycje, when migracja przelicza `name_key` nową normalizacją, then klucze są aktualne; given dwie pozycje jednej listy, które po przeliczeniu kolidują, then migracja nie pada: zostawia starszą z kluczem, a nowszej nadaje klucz rozróżniony (np. sufiks z `id`) i zapisuje w logu migracji liczbę takich przypadków; zapis odwracalny (`down` opisany w notatce). — verified by: test migracji na bazie z danymi przed migracją
- [ ] SEC1 (TH-29): Given atakujący wysyła przez API imię „Ania‮gnp.exe” albo nazwę listy z samym U+200B, when rejestracja / zmiana nazwy / dodanie pozycji, then 400 `validation_failed` (pole `invalid`) i nic nie jest zapisane; given „Mleko​” przy istniejącym „Mleko”, then 409 `duplicate_item`. — verified by: testy integracyjne na każdej trasie zapisu tekstu (rejestracja, listy, pozycje)

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- funkcje `packages/shared` (`requiredName`, schemat notatki, `normalizeItemName`)
- HTTP API rejestracji, list i pozycji (`fastify.inject`)
- migracja na bazie Testcontainers z danymi wstawionymi przed nią
- ekrany SC-02, SC-05, SC-06 z MSW

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | każda klasa znaków (Cc, Cf, bidi) odrzucona; polskie znaki i zwykłe spacje przyjęte | unit | Vitest | AC1 |
| 2 | wymóg widocznego znaku | unit | Vitest | AC2 |
| 3 | `normalizeItemName`: NFKC, ignorowalne, wielkość liter | unit | Vitest | AC3 |
| 4 | API: 400 na każdej trasie zapisu tekstu; 409 dla wariantu duplikatu | integration | Vitest + Testcontainers | SEC1, AC3 |
| 5 | migracja przelicza `name_key`; kolizja nie przerywa migracji | integration | Vitest + Testcontainers | AC5 |
| 6 | komunikat pola na SC-02, SC-05, SC-06 | component | Vitest + RTL + MSW | AC4 |

**Run:** `pnpm vitest run --project shared` oraz komendy „wszystkie testy warstwy” z przewodników backend, db i web

**Mocks:** API tylko w testach komponentów; baza prawdziwa.

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** wklejanie tekstu z Worda / komunikatora (miękkie spacje U+00A0, U+202F — przyjąć czy znormalizować? zapisać decyzję); emoji (🥛, flagi, emoji z odcieniem skóry i ZWJ); nazwy z ł, ż, ą w różnej postaci Unicode (NFD z macOS); notatka z nową linią.
- **Design states:** komunikat przy polu na SC-02, SC-05 (nowa lista i zmiana nazwy), SC-06 (dodanie, edycja nazwy, notatka).
- **Platforms / devices:** iOS (klawiatura wstawia znaki niewidoczne przy dyktowaniu?), Android, komputer.
- **Accessibility:** komunikat czytany z polem, fokus na polu.
- **Security / privacy:** TH-29 — próba podszycia się imieniem z RLO, nazwą listy pustą wizualnie, duplikatem z zero-width; sprawdzić SC-08 (imię właściciela w zaproszeniu).
- **Regression:** F-09 (duplikat wielkością liter, także wśród odhaczonych), limity długości (100 / 200 / 30 znaków liczone po normalizacji?), J-01 rejestracja.

## Implementation notes

- Jedna reguła w `packages/shared/src/api/text.ts` (np. `visibleText(max)`), użyta przez wszystkie schematy tekstu widocznego dla innych; regex z właściwościami Unicode (`\p{Cc}`, `\p{Cf}`, `\p{Default_Ignorable_Code_Point}`).
- Długość liczona tak jak dziś (zmiana sposobu liczenia to osobna decyzja).
- Istniejące imiona i nazwy list z niedozwolonymi znakami: migracja ich nie zmienia (tylko `name_key`); nowe zapisy przechodzą przez nową regułę. Zapisz to w `data-model.md`.
- Zaktualizuj `data-model.md` (definicja `name_key`) i TH-29 w `threat-model.md` (testy, które ją weryfikują).

## Definition of done

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>
