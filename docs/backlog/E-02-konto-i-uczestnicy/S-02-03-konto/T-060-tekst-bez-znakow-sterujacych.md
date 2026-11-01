---
id: T-060
title: "Tekst widoczny dla innych bez znaków sterujących i bidi; duplikat po NFKC"
epic: E-02
story: S-02-03
status: in-progress    # todo | in-progress | in-qa | done | blocked
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

Stan po pierwszym przebiegu (2026-11-01): testy 1–4 i 6 z planu zielone, test 5 (migracja, AC5) nie zaczęty, bo czeka na odpowiedź w „Open question”. Test 6 zrobiony przed 5, bo nie zależy od migracji.

**Testy (red → green):**

1. `packages/shared/test/visible-text.test.ts` › „control, format and bidi characters (T-060 AC1)”: każde pole (imię przy rejestracji, nazwa listy, nazwa pozycji przy dodaniu i edycji, notatka przy dodaniu i edycji) × 22 znaki (Cc: TAB, CR, ESC, DEL, U+0085; Cf: U+200B, U+200D, U+FEFF, U+2060, U+00AD; bidi: U+202A–202E, U+2066–2069, U+200E, U+200F, U+061C); polskie litery, NFD i spacje przyjęte; `\n` tylko w notatce. Red: 134 failed, np. `expected {} to deeply equal { name: 'invalid' }`. Green.
2. Ten sam plik › „at least one visible character (T-060 AC2)”: U+3164, U+FFA0, U+2800, same znaki łączące, sam U+FE0F → `invalid`; „Ania” + U+3164 i „Mleko” + U+FE0F → `invalid`; emoji przyjęte (🥛, 👨‍👩‍👧, 👩🏽‍🍳, ❤️, 🏳️‍🌈, 🇵🇱, 🏴 + tagi, 1️⃣); ZWJ i U+FE0F poza emoji → `invalid`. Red: 37 failed (`expected undefined to be 'invalid'`, `expected 'invalid' to be undefined`). Green.
3. `packages/shared/test/items.test.ts` › „normalizeItemName: compatibility forms and invisible characters (T-060 AC3)”: ｍｌｅｋｏ → „mleko”, ﬁlet → „filet”, „Mleko” z U+200B / U+200D / U+FEFF → „mleko”. Red: `expected 'ｍｌｅｋｏ' to be 'mleko'`, `expected 'mleko​' to be 'mleko'`. Green.
4. `apps/api/test/visible-text.security.test.ts`: 400 `validation_failed` (`invalid`) i nic nie zapisane dla rejestracji „Ania” + RLO + „gnp.exe”, `POST /lists` z samym U+200B, `PATCH /lists/:id` z RLO, `POST …/items` (nazwa z RLO, nazwa z samym U+200B, notatka z RLO), `PATCH …/items/:id` (nazwa z RLO, notatka z U+200B); 409 `duplicate_item` dla ｍｌｅｋｏ przy „Mleko” i ﬁlet przy „filet”. Red (na kodzie `packages/shared/src` sprzed zmian, `git stash`): 10 failed, `expected 200 to be 400`, `expected 201 to be 400`, `expected 201 to be 409`. Green. **Brak jeszcze:** 409 dla „Mleko” + U+200B przy „Mleko” (SEC1), patrz „Open question”, pytanie 2.
6. Komunikat pola „Usuń niewidoczne lub specjalne znaki.” przy `invalid` z API (MSW), `aria-describedby`, fokus: `SignUpScreen.test.tsx` › „asks to remove hidden characters from the name the API refuses (T-060 AC4)” (fokus na podsumowaniu, link → pole, jak w SC-02), `ListsScreen.test.tsx` › „asks to remove hidden characters when the API refuses the name (T-060 AC4)” (SC-05), `ListScreen.test.tsx` › to samo dla zmiany nazwy listy (SC-06), `ListScreen.add.test.tsx` i `ListScreen.edit.test.tsx` › „asks to remove hidden characters from the name / note the API refuses, focus on it (T-060 AC4)”. Red: `toHaveAccessibleDescription()` (stary tekst „Wpisz imię” albo brak opisu), potem `toHaveFocus()`. Green. Zmieniony test T-026 (NUL w imieniu): oczekuje teraz nowego komunikatu, bo NUL to znak sterujący, a AC4 zmienia tekst dla `invalid`.

**Przebieg tego stanu:** `pnpm typecheck` OK, `pnpm lint` OK, `pnpm vitest run --project web --project tokens --project shared`: 484 passed; `pnpm vitest run --project api`: 318 passed (77 plików).

**Decyzje w kodzie:**

- Jedna reguła w `packages/shared/src/api/text.ts`: `requiredName(max)` (imię, nazwy) i `optionalNote(max)` (notatka). Odrzucane `\p{Cc}`, `\p{Cf}` i `\p{Default_Ignorable_Code_Point}` (to ostatnie łapie wypełniacze Hangul i selektory wariantu); wyjątki tylko w sekwencjach emoji. Widoczny znak: nie odstęp, nie `\p{M}`, nie `\p{C}`, nie ignorowalny, nie U+2800.
- Miękka spacja U+00A0 i U+202F (QA plan): przyjęte. To odstępy (Zs): `trim` usuwa je z brzegów, NFKC w kluczu zamienia je na zwykłą spację.
- `normalizeItemName`: `trim` → NFKC → usunięcie `Default_Ignorable_Code_Point` → `trim` → `toLocaleLowerCase('pl-PL')` (drugi `trim`, bo usunięty znak mógł stać za spacją).
- Web: `HIDDEN_CHARACTERS_TEXT` w `apps/web/src/errorText.ts` (jedno miejsce dla trzech ekranów); `useFieldFocus` w `components/useFocus.ts` (fokus na polu z błędem po przerysowaniu, gdy komunikat jest już w `aria-describedby`); `useItemFieldErrors` (`SC-06-lista/itemFieldErrors.ts`) dla AddBar i arkusza edycji; `useListNameForm` dostaje `fieldRef`. Fokus przenosi też błąd ze schematu po stronie klienta (te same reguły co API).
- Ryzyko na później (mobile): reguła używa `\p{…}` i lookbehind; przy pierwszym użyciu w aplikacji Expo sprawdzić obsługę w Hermes.

**Do zrobienia przez właściciela (poza zakresem implementera: `docs/design/`, `docs/architecture/`):** dopisać copy „Usuń niewidoczne lub specjalne znaki.” do tabel Copy SC-02, SC-05, SC-06; zaktualizować definicję `name_key` w `data-model.md` (NFKC + usunięcie ignorowalnych) i dopisać, że migracja nie zmienia istniejących imion i nazw list; w TH-29 (`threat-model.md`) wpisać testy `packages/shared/test/visible-text.test.ts` i `apps/api/test/visible-text.security.test.ts`.

## Open question

Implementacja zatrzymana po zielonych testach 1–4 i 6 (szczegóły w Evidence). Dwie decyzje blokują AC5 i część SEC1; trzecia jest drobna.

1. **Jak przeliczyć `name_key` migracją (AC5)?** Klucz wolno liczyć tylko funkcją `normalizeItemName` z `packages/shared` (`layers/db.md`: „nigdy `lower()` w SQL”), a migracje Drizzle to wyłącznie pliki SQL: dziś migracja nie może wywołać kodu TS. To nowy wzorzec wdrożenia (`release_command`, `db:migrate`).
   - **Rekomendacja:** krok migracji danych w TS w `runMigrations` (`apps/api/src/db/migrate.ts`), uruchamiany po migracjach SQL. Tabela `data_migration` (nazwa, czas) pilnuje, że krok biegnie raz. Krok `0007_name_key_nfkc` w jednej transakcji czyta pozycje partiami, liczy `normalizeItemName(name)`, przy kolizji w liście zostawia klucz starszej pozycji (`created_at`, potem `id`), a nowszej daje `<klucz>#<id>`, i loguje liczbę kolizji. `down` opisany w notatce (stary klucz = `trim` + NFC + lower). Test: Testcontainers, dane wstawione przed krokiem, eksportowana funkcja kroku.
   - **Alternatywa:** czysta migracja SQL: `normalize(name, NFKC)`, `regexp_replace` z jawną listą zakresów `Default_Ignorable_Code_Point` i `lower(… COLLATE "pl-PL-x-icu")`. Bez nowego mechanizmu, ale łamie zasadę „`name_key` tylko z `packages/shared`” i może się rozjechać z `toLocaleLowerCase('pl-PL')` na znakach brzegowych.
2. **„Mleko” + U+200B przy istniejącym „Mleko”: 409 czy 400?** AC1 każe odrzucić nazwę pozycji z U+200B jako `invalid` (400), a SEC1, Demo 1 i kryterium story każą zwrócić duplikat (409 / „„Mleko” jest już na liście…”). Walidacja biegnie przed sprawdzeniem duplikatu (API: schemat przed `requireListAccess`; web: schemat przed `sameNameAs`), więc dziś wychodzi 400 i „Usuń niewidoczne lub specjalne znaki.”.
   - **Rekomendacja:** duplikat wygrywa tylko dla nazwy pozycji. Gdy jedynym błędem nazwy są ukryte znaki, API po `requireListAccess` sprawdza klucz `normalizeItemName` i przy kolizji zwraca 409, a bez kolizji 400 `invalid`; web w tej samej kolejności (lokalny duplikat przed komunikatem o znakach). Spełnia AC1 (schemat), SEC1 i Demo 1.
   - **Alternatywa:** walidacja wygrywa wszędzie (400 i „Usuń niewidoczne lub specjalne znaki.”); SEC1 i Demo 1 zmienione na 400. Usuwanie ignorowalnych w kluczu działa wtedy tylko dla starych danych, a NFKC dla ﬁlet i ｍｌｅｋｏ.
3. **Fokus na SC-02 (drobne):** AC4 mówi „fokus na polu”, a specyfikacja SC-02 mówi „po błędach walidacji fokus na podsumowaniu błędów (linki do pól)”. Zrobione wg SC-02 (podsumowanie, link przenosi na pole). Rekomendacja: zostawić tak. Alternatywa: fokus od razu na polu „Imię”.
