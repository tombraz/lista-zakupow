---
id: T-060
title: "Tekst widoczny dla innych bez znaków sterujących i bidi; duplikat po NFKC"
epic: E-02
story: S-02-03
status: done           # todo | in-progress | in-qa | done | blocked
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

- [x] AC1: Given tekst ze znakiem z kategorii Cc (poza NUL — już odrzucany), Cf (np. U+200B, U+200D, U+FEFF, U+2060) albo bidi (U+202A–U+202E, U+2066–U+2069, U+200E, U+200F, U+061C), when walidacja imienia, nazwy listy, nazwy pozycji lub notatki, then błąd `invalid`; dla notatki dozwolone są tylko zwykłe spacje i (jeśli notatka je dziś przyjmuje) znak nowej linii. — verified by: testy unit dla każdej klasy znaków
- [x] AC2: Given tekst złożony tylko ze znaków niewidocznych (np. U+3164, U+2800, same znaki łączące), when walidacja pola wymaganego, then błąd `invalid` (wymóg widocznego znaku). Wyjątek od AC1: U+200D (ZWJ) i selektor wariantu U+FE0F są dozwolone tylko wewnątrz sekwencji emoji (między znakami `Extended_Pictographic`), więc „Rodzina 👨‍👩‍👧” i „🥛” przechodzą, a „Mleko‍” nie. — verified by: testy unit
- [x] AC3: Given `normalizeItemName`, then klucz = `trim` + NFKC + usunięcie znaków `Default_Ignorable_Code_Point` + `toLocaleLowerCase('pl-PL')`; „Mleko”, „MLEKO”, „ｍｌｅｋｏ” i „ﬁlet”/„filet” dają ten sam klucz co odpowiednik. Given API `POST …/items` z takim wariantem, then 409 `duplicate_item`. — verified by: testy unit + test integracyjny
- [x] AC4: Given web (SC-02 imię, SC-05 nazwa listy, SC-06 nazwa i notatka pozycji), when API zwraca `invalid` dla pola, then pod polem komunikat „Usuń niewidoczne lub specjalne znaki.” (copy zatwierdzone przez właściciela 2026-11-01 — dopisać do Copy SC-02, SC-05, SC-06), powiązany z polem (`aria-describedby`), fokus na polu. — verified by: testy komponentów (MSW)
- [x] AC5: Given istniejące pozycje, when migracja przelicza `name_key` nową normalizacją, then klucze są aktualne; given dwie pozycje jednej listy, które po przeliczeniu kolidują, then migracja nie pada: zostawia starszą z kluczem, a nowszej nadaje klucz rozróżniony (np. sufiks z `id`) i zapisuje w logu migracji liczbę takich przypadków; zapis odwracalny (`down` opisany w notatce). — verified by: test migracji na bazie z danymi przed migracją
- [x] SEC1 (TH-29): Given atakujący wysyła przez API imię „Ania‮gnp.exe” albo nazwę listy z samym U+200B, when rejestracja / zmiana nazwy / dodanie pozycji, then 400 `validation_failed` (pole `invalid`) i nic nie jest zapisane; given „Mleko​” przy istniejącym „Mleko”, then 409 `duplicate_item`. — verified by: testy integracyjne na każdej trasie zapisu tekstu (rejestracja, listy, pozycje)

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

- [x] All tests in the TDD plan written test-first and passing
- [x] Full test suite, type check and lint pass
- [x] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

Pierwszy przebieg (2026-11-01): testy 1–4 i 6; drugi przebieg (po odpowiedzi w „Open question”, 2026-11-01): test 5 (AC5), 4b i 6b (decyzja 2: duplikat wygrywa dla nazwy pozycji). Test 6 zrobiony przed 5, bo nie zależy od migracji.

**Testy (red → green):**

1. `packages/shared/test/visible-text.test.ts` › „control, format and bidi characters (T-060 AC1)”: każde pole (imię przy rejestracji, nazwa listy, nazwa pozycji przy dodaniu i edycji, notatka przy dodaniu i edycji) × 22 znaki (Cc: TAB, CR, ESC, DEL, U+0085; Cf: U+200B, U+200D, U+FEFF, U+2060, U+00AD; bidi: U+202A–202E, U+2066–2069, U+200E, U+200F, U+061C); polskie litery, NFD i spacje przyjęte; `\n` tylko w notatce. Red: 134 failed, np. `expected {} to deeply equal { name: 'invalid' }`. Green.
2. Ten sam plik › „at least one visible character (T-060 AC2)”: U+3164, U+FFA0, U+2800, same znaki łączące, sam U+FE0F → `invalid`; „Ania” + U+3164 i „Mleko” + U+FE0F → `invalid`; emoji przyjęte (🥛, 👨‍👩‍👧, 👩🏽‍🍳, ❤️, 🏳️‍🌈, 🇵🇱, 🏴 + tagi, 1️⃣); ZWJ i U+FE0F poza emoji → `invalid`. Red: 37 failed (`expected undefined to be 'invalid'`, `expected 'invalid' to be undefined`). Green.
3. `packages/shared/test/items.test.ts` › „normalizeItemName: compatibility forms and invisible characters (T-060 AC3)”: ｍｌｅｋｏ → „mleko”, ﬁlet → „filet”, „Mleko” z U+200B / U+200D / U+FEFF → „mleko”. Red: `expected 'ｍｌｅｋｏ' to be 'mleko'`, `expected 'mleko​' to be 'mleko'`. Green.
4. `apps/api/test/visible-text.security.test.ts`: 400 `validation_failed` (`invalid`) i nic nie zapisane dla rejestracji „Ania” + RLO + „gnp.exe”, `POST /lists` z samym U+200B, `PATCH /lists/:id` z RLO, `POST …/items` (nazwa z RLO, nazwa z samym U+200B, notatka z RLO), `PATCH …/items/:id` (nazwa z RLO, notatka z U+200B); 409 `duplicate_item` dla ｍｌｅｋｏ przy „Mleko” i ﬁlet przy „filet”. Red (na kodzie `packages/shared/src` sprzed zmian, `git stash`): 10 failed, `expected 200 to be 400`, `expected 201 to be 400`, `expected 201 to be 409`. Green.
4b. (decyzja 2, drugi przebieg) Ten sam plik › „an item name with hidden characters whose key is already on the list”: `POST` „Mleko” + U+200B przy „Mleko” → 409 `duplicate_item`, nic nie dodane; `PATCH` „Chleb” → „Mleko” + U+200B → 409; „Masło” + U+200B (bez kolizji) → 400 `invalid`; zła też notatka → 400 z oboma polami; zmiana „Mleko” na własną nazwę + U+200B → 400; obcy domownik → 404 `not_found` (sprawdzenie klucza dopiero po `requireListAccess`, bez ujawnienia pozycji). Red: 3 failed — `expected 400 to be 409` (×2), `expected 400 to be 404`. Green.
5. `apps/api/test/name-key-migration.test.ts` (Testcontainers; pozycje wstawione z kluczem starej reguły, potem `runMigrations`): „recomputes stale keys and leaves names unchanged” (ｍｌｅｋｏ → mleko, ﬁlet → filet, „Chleb” + U+200B → chleb, „Masło” bez zmian, nazwy nietknięte); „keeps the key of the older item and gives the newer one a distinct key on a collision” (starsza ｍｌｅｋｏ dostaje „mleko”, nowsza „Mleko” → `mleko#<id>`, ta sama nazwa w innej liście bez kolizji; log `data migration 0007_name_key_nfkc: 3 keys updated, 1 collisions`); „recomputes keys across batches” (2500 pozycji, partie po 1000); „runs the step once” (drugie `runMigrations` nic nie zmienia, wiersz `data_migration`). Red (stub `runMigrations(pool, options)` bez kroku): 3 failed — `expected [ [ 'ｍｌｅｋｏ', 'ｍｌｅｋｏ' ], …] to deeply equal [ [ 'ｍｌｅｋｏ', 'mleko' ], …]` (×2), `relation "data_migration" does not exist`. Green. Test partii dopisany po implementacji; sprawdzone, że gryzie: z krokiem kończącym po pierwszej partii `expected [ { stale: 1500 } ] to deeply equal [ { stale: +0 } ]`, kod przywrócony.
6. Komunikat pola „Usuń niewidoczne lub specjalne znaki.” przy `invalid` z API (MSW), `aria-describedby`, fokus: `SignUpScreen.test.tsx` › „asks to remove hidden characters from the name the API refuses (T-060 AC4)” (fokus na podsumowaniu, link → pole, jak w SC-02), `ListsScreen.test.tsx` › „asks to remove hidden characters when the API refuses the name (T-060 AC4)” (SC-05), `ListScreen.test.tsx` › to samo dla zmiany nazwy listy (SC-06), `ListScreen.add.test.tsx` i `ListScreen.edit.test.tsx` › „asks to remove hidden characters from the name / note the API refuses, focus on it (T-060 AC4)”. Red: `toHaveAccessibleDescription()` (stary tekst „Wpisz imię” albo brak opisu), potem `toHaveFocus()`. Green. Zmieniony test T-026 (NUL w imieniu): oczekuje teraz nowego komunikatu, bo NUL to znak sterujący, a AC4 zmienia tekst dla `invalid`.
6b. (decyzja 2) `ListScreen.add.test.tsx` › „warns about the duplicate, not the hidden character, for „Mleko” + U+200B (T-060 Demo 1)” i `ListScreen.edit.test.tsx` › „refuses to rename „Masło” to „Mleko” + U+200B as a duplicate (T-060)”: ostrzeżenie o duplikacie, bez komunikatu o znakach, bez żądania. Red: `Unable to find role="alert"` (×2). Green.

**Przebieg końcowy (drugi przebieg, 2026-11-01):** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm quality` (jscpd: 0 klonów; depcruise: 0 naruszeń), `pnpm design-check` — OK; `pnpm test`: 114 plików, 814 passed; `pnpm test:mobile`: 10 passed; `pnpm build` OK. E2E (Playwright) nie uruchamiane — plan ich nie przewiduje.

**Kryteria:**

- AC1 — test 1 (każda klasa znaków × każde pole); SEC1/test 4 na trasach.
- AC2 — test 2 (wymóg widocznego znaku, wyjątki emoji).
- AC3 — test 3 (unit) + test 4 (409 dla ｍｌｅｋｏ i ﬁlet).
- AC4 — test 6 (komunikat, `aria-describedby`, fokus; SC-02 fokus na podsumowaniu wg decyzji 3).
- AC5 — test 5 (przeliczenie, kolizja bez przerwania, log liczby kolizji, raz); `down` opisany w komentarzu `apps/api/src/db/data-migrations/0007-name-key-nfkc.ts`.
- SEC1 — test 4 (400 i nic nie zapisane na rejestracji, `POST`/`PATCH` list, `POST`/`PATCH` pozycji) + 4b (409 dla „Mleko” + U+200B przy „Mleko”).

**Decyzje w kodzie:**

- Jedna reguła w `packages/shared/src/api/text.ts`: `requiredName(max)` (imię, nazwy) i `optionalNote(max)` (notatka). Odrzucane `\p{Cc}`, `\p{Cf}` i `\p{Default_Ignorable_Code_Point}` (to ostatnie łapie wypełniacze Hangul i selektory wariantu); wyjątki tylko w sekwencjach emoji. Widoczny znak: nie odstęp, nie `\p{M}`, nie `\p{C}`, nie ignorowalny, nie U+2800.
- Miękka spacja U+00A0 i U+202F (QA plan): przyjęte. To odstępy (Zs): `trim` usuwa je z brzegów, NFKC w kluczu zamienia je na zwykłą spację.
- `normalizeItemName`: `trim` → NFKC → usunięcie `Default_Ignorable_Code_Point` → `trim` → `toLocaleLowerCase('pl-PL')` (drugi `trim`, bo usunięty znak mógł stać za spacją).
- Web: `HIDDEN_CHARACTERS_TEXT` w `apps/web/src/errorText.ts` (jedno miejsce dla trzech ekranów); `useFieldFocus` w `components/useFocus.ts` (fokus na polu z błędem po przerysowaniu, gdy komunikat jest już w `aria-describedby`); `useItemFieldErrors` (`SC-06-lista/itemFieldErrors.ts`) dla AddBar i arkusza edycji; `useListNameForm` dostaje `fieldRef`. Fokus przenosi też błąd ze schematu po stronie klienta (te same reguły co API).
- Migracja danych (decyzja 1, wpis w `tech-stack.md` od właściciela): `runMigrations` po migracjach SQL wykonuje kroki z `apps/api/src/db/data-migrations/`; każdy w jednej transakcji z wstawieniem wiersza `data_migration` (`ON CONFLICT DO NOTHING`), więc równoległy drugi proces czeka na klucz główny i pomija krok. Tabela z migracji SQL `0007_data_migration.sql`. Krok `0007_name_key_nfkc` na czas przeliczenia zdejmuje i zakłada z powrotem `item_list_id_name_key_unique` (nowy klucz jednej pozycji może chwilowo równać się nieprzeliczonemu kluczowi innej); `ALTER TABLE` blokuje tabelę `item` na czas kroku (krótko przy obecnych danych). Log: `migrate-cli` wypisuje `data migration 0007_name_key_nfkc: N keys updated, M collisions` (widoczny w logu `release_command`).
- Duplikat przed błędem znaków (decyzja 2): `onlyItemNameInvalid(fields)` w `packages/shared/src/api/items.ts` — jedyny błąd to `name: invalid`. API: `validateOr` w `apps/api/src/http/validate.ts` + `duplicateBeforeRefusal` w `pozycje/http/routes.ts` (po `requireListAccess`) + `refuseDuplicateName` w domenie i `nameKeyTaken` w repozytorium. Web: ta sama kolejność w `useAddItem.submit` i `checkEdit` (`useEditItem.ts`).
- Ryzyko na później (mobile): reguła używa `\p{…}` i lookbehind; przy pierwszym użyciu w aplikacji Expo sprawdzić obsługę w Hermes.

**Przewodniki warstw (Step 8b, fakty):** `layers/db.md` „Gdzie jest kod” — `0007_data_migration.sql`, `src/db/data-migrations/`; `layers/backend.md` — `optionalNote`, `onlyItemNameInvalid`, `validateOr`.

**Do zrobienia przez właściciela (poza zakresem implementera: `docs/design/`, `docs/architecture/`):** w `data-model.md` dopisać tabelę `data_migration` i krok `0007_name_key_nfkc` (kolizja → `<klucz>#<id>`); dopisać copy „Usuń niewidoczne lub specjalne znaki.” do tabel Copy SC-02, SC-05, SC-06; zaktualizować definicję `name_key` w `data-model.md` (NFKC + usunięcie ignorowalnych) i dopisać, że migracja nie zmienia istniejących imion i nazw list; w TH-29 (`threat-model.md`) wpisać testy `packages/shared/test/visible-text.test.ts` i `apps/api/test/visible-text.security.test.ts`.

## Open question

Implementacja zatrzymana po zielonych testach 1–4 i 6 (szczegóły w Evidence). Dwie decyzje blokują AC5 i część SEC1; trzecia jest drobna.

1. **Jak przeliczyć `name_key` migracją (AC5)?** Klucz wolno liczyć tylko funkcją `normalizeItemName` z `packages/shared` (`layers/db.md`: „nigdy `lower()` w SQL”), a migracje Drizzle to wyłącznie pliki SQL: dziś migracja nie może wywołać kodu TS. To nowy wzorzec wdrożenia (`release_command`, `db:migrate`).
   - **Rekomendacja:** krok migracji danych w TS w `runMigrations` (`apps/api/src/db/migrate.ts`), uruchamiany po migracjach SQL. Tabela `data_migration` (nazwa, czas) pilnuje, że krok biegnie raz. Krok `0007_name_key_nfkc` w jednej transakcji czyta pozycje partiami, liczy `normalizeItemName(name)`, przy kolizji w liście zostawia klucz starszej pozycji (`created_at`, potem `id`), a nowszej daje `<klucz>#<id>`, i loguje liczbę kolizji. `down` opisany w notatce (stary klucz = `trim` + NFC + lower). Test: Testcontainers, dane wstawione przed krokiem, eksportowana funkcja kroku.
   - **Alternatywa:** czysta migracja SQL: `normalize(name, NFKC)`, `regexp_replace` z jawną listą zakresów `Default_Ignorable_Code_Point` i `lower(… COLLATE "pl-PL-x-icu")`. Bez nowego mechanizmu, ale łamie zasadę „`name_key` tylko z `packages/shared`” i może się rozjechać z `toLocaleLowerCase('pl-PL')` na znakach brzegowych.
2. **„Mleko” + U+200B przy istniejącym „Mleko”: 409 czy 400?** AC1 każe odrzucić nazwę pozycji z U+200B jako `invalid` (400), a SEC1, Demo 1 i kryterium story każą zwrócić duplikat (409 / „„Mleko” jest już na liście…”). Walidacja biegnie przed sprawdzeniem duplikatu (API: schemat przed `requireListAccess`; web: schemat przed `sameNameAs`), więc dziś wychodzi 400 i „Usuń niewidoczne lub specjalne znaki.”.
   - **Rekomendacja:** duplikat wygrywa tylko dla nazwy pozycji. Gdy jedynym błędem nazwy są ukryte znaki, API po `requireListAccess` sprawdza klucz `normalizeItemName` i przy kolizji zwraca 409, a bez kolizji 400 `invalid`; web w tej samej kolejności (lokalny duplikat przed komunikatem o znakach). Spełnia AC1 (schemat), SEC1 i Demo 1.
   - **Alternatywa:** walidacja wygrywa wszędzie (400 i „Usuń niewidoczne lub specjalne znaki.”); SEC1 i Demo 1 zmienione na 400. Usuwanie ignorowalnych w kluczu działa wtedy tylko dla starych danych, a NFKC dla ﬁlet i ｍｌｅｋｏ.
3. **Fokus na SC-02 (drobne):** AC4 mówi „fokus na polu”, a specyfikacja SC-02 mówi „po błędach walidacji fokus na podsumowaniu błędów (linki do pól)”. Zrobione wg SC-02 (podsumowanie, link przenosi na pole). Rekomendacja: zostawić tak. Alternatywa: fokus od razu na polu „Imię”.

Answer: (1) Rekomendacja: krok migracji danych w TS w runMigrations (tabela data_migration, krok 0007_name_key_nfkc, kolizja: nowsza pozycja dostaje <klucz>#<id>). (2) Rekomendacja: duplikat wygrywa tylko dla nazwy pozycji (409 przy kolizji klucza po requireListAccess, inaczej 400 invalid; web w tej samej kolejności). (3) Rekomendacja: fokus na podsumowaniu błędów wg SC-02, bez zmian.

## QA round 1 (2026-11-01)

Verdict: pass

Zakres: commity `712b035` (WIP) i `6225bc9` (+ logi postępu). Od czystego stanu: `pnpm install --frozen-lockfile`, `format:check`, `lint`, `typecheck`, `quality` (jscpd 0 klonów, depcruise 0 naruszeń), `design-check`, `pnpm test` (114 plików, 814 passed), `test:mobile` (10 passed), `build` — wszystko zielone. `pnpm test:e2e`: 58 passed (J-01, J-02, J-03 bez regresji, skany axe).

**Kryteria akceptacji**

| AC | Wynik | Jak sprawdzone |
| --- | --- | --- |
| AC1 | pass | `visible-text.test.ts` czyta każde pole × 22 znaki; sonda własna: TAB, CR, U+00AD, U+2061, U+180E, U+034F, U+FFF9, U+E0001, ZWNJ → `invalid`; `\n` tylko w notatce, `\r\n` w notatce → `invalid`. |
| AC2 | pass | U+2800, U+3164, U+115F, U+1160, same znaki łączące → `invalid`; „Rodzina 👨‍👩‍👧”, 👍🏽, 🥛 przyjęte; ZWJ między literami i „❤️‍a” → `invalid`. |
| AC3 | pass | Unit + API; sonda: „mleko” + U+00AD, U+200B + „MLEKO”, „Mleko” + RLO przy „Mleko” → 409; „𝐌𝐥𝐞𝐤𝐨” → klucz „mleko”; NFD „żółw” = NFC. |
| AC4 | pass | Testy komponentów (MSW) + własny przebieg Playwright (telefon): SC-02 (RLO w imieniu → podsumowanie + komunikat pod polem, brak konta), SC-05 (sam U+200B → komunikat, fokus na polu), SC-06 (nazwa z RLO i notatka z U+200B → komunikat w `aria-describedby`, fokus na polu); skany axe tych stanów bez naruszeń. |
| AC5 | pass | `name-key-migration.test.ts` (przeliczenie, kolizja `<klucz>#<id>`, log liczby kolizji, partie, jednokrotność); `down` opisany w komentarzu kroku. |
| SEC1 | pass | Testy integracyjne na każdej trasie + własne próby (Testcontainers): obcy domownik `PATCH`/`POST` z „Mleko” + U+200B → 404 (bez ujawnienia klucza), anonim → 401, zły `listId` → 404, rejestracja z U+2067 → 400 i brak konta. |

Demo 1–3 odtworzone w przeglądarce (Playwright): „Mleko” + U+200B i „ﬁlet” → ostrzeżenie o duplikacie; RLO w imieniu / nazwie → komunikat przy polu.

**Spot-checki (każdy przywrócony, `git status` czysty):** usunięcie `refine(withoutHiddenCharacters)` → 102 testy czerwone; NFKC → NFC w `normalizeItemName` → 6 czerwonych (unit, API, migracja); `duplicateBeforeRefusal` wyłączone → 3 czerwone (4b); wyłączona obsługa kolizji w kroku migracji → 1 czerwony; zmieniony `HIDDEN_CHARACTERS_TEXT` → 8 czerwonych testów komponentów. Evidence ma czerwone komunikaty dla każdego testu z planu.

**Ustalenia**

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | security (TH-29) | Separatory wiersza i akapitu U+2028 / U+2029 (Zl/Zp, nie Cc/Cf) są przyjmowane w imieniu, nazwach i notatce; przeglądarka łamie na nich wiersz, więc imię „Ania⏎Admin” wygląda jak dwa wiersze. Poza literą AC1, ale w duchu TH-29. | `POST …/items` „Masło\u2028Kowal” → 201; rejestracja „Ania\u2028Admin” → 200 | Decyzja właściciela: dopisać Zl/Zp do odrzucanych (notatka ma już `\n`). |
| 2 | minor | security (TH-29) | Znaki tagów U+E0020–E007F są przyjmowane w dowolnej liczbie po 🏴 (wyjątek dla flag subdywizji), więc w nazwie można ukryć niewidoczny tekst („Ania 🏴” + tagi „hide”). Klucz duplikatu je usuwa, więc F-09 działa. | sonda `listNameRequestSchema`: „Ania 🏴\u{E0068}…” → ACCEPT | Wyjątek tylko dla poprawnej sekwencji flagi (2–6 tagów liter + U+E007F). |
| 3 | minor | validation | Znaki prywatnego użytku (Co, np. U+E000) i samotny surogat (Cs) są przyjmowane, gdy obok jest widoczny znak. | „Ania\uE000”, „Ania\uD800” → ACCEPT | Rozważyć odrzucenie `\p{Co}` / `\p{Cs}` razem z Cc/Cf. |
| 4 | minor | docs | Dokumenty nie opisują nowego stanu (implementer nie może ich zmieniać i zgłosił to w Evidence): `data-model.md` nadal definiuje `name_key` jako trim + NFC + lower, brak tabeli `data_migration` i kroku `0007_name_key_nfkc`; copy „Usuń niewidoczne lub specjalne znaki.” nie jest w tabelach Copy SC-02 / SC-05 / SC-06 (AC4 „dopisać”); TH-29 w `threat-model.md` bez wskazania testów. | `grep name_key docs/architecture/data-model.md` (wiersz 102) | Właściciel dopisuje (lista w Evidence, „Do zrobienia przez właściciela”). |
| 5 | note | testing | Nowy stan błędu pola nie ma skanu axe w stałym E2E (strategia: skan każdego stanu). Sprawdzone ręcznie tymczasowym spec Playwright: bez naruszeń. | — | Dopisać kroki do `j01-konto` / `j03-pozycje` przy okazji. |
| 6 | note | deploy | W oknie wdrożenia stara wersja API (jeszcze obsługująca ruch po `release_command`) zapisuje klucze starą regułą; „ｍｌｅｋｏ” dodane wtedy przy „Mleko” nie będzie duplikatem. Ryzyko małe. | analiza `0007-name-key-nfkc.ts` | Akceptować albo powtórzyć krok w kolejnej wersji. |
| 7 | note | mobile | Reguła używa `\p{…}` i lookbehind — sprawdzić w Hermes przy pierwszym użyciu w Expo (zgłoszone przez implementera). | Evidence | — |

Nie sprawdzone ręcznie: iOS / Android (dyktowanie), VoiceOver / TalkBack — brak urządzeń w tym przebiegu; czytanie komunikatu z polem potwierdza `aria-describedby` w testach i w przeglądarce.
