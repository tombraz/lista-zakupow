---
id: T-101
title: "API: reguła eslint — `log.error` tylko w `logging.ts` i handlerze błędów; poprawki dokumentów po T-098"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done                  # todo | in-progress | in-qa | done | blocked
depends_on: [T-098]
layers: [backend, infra]
requirements: []
threats: [TH-21]
screens: []
related_tasks: [T-098, T-035, T-089]
---

# T-101 API: reguła eslint — `log.error` tylko w `logging.ts` i handlerze błędów; poprawki dokumentów po T-098

## Report

Źródło: QA T-098 runda 1 (2026-11-05), uwagi 1, 2 i 6, zaakceptowane przez właściciela 2026-11-05. Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:**
  - Kształt wpisu błędu po zapisie i w tle (`event` + `err: errorSummary`) jest zapisany tylko w dokumencie (`docs/architecture/layers/backend.md`, „Pułapki”). Nic nie blokuje nowego `log.error({ … })` z innym kształtem. Ta sama uwaga pojawiła się w dwóch przeglądach: `docs/reviews/E-02-2026-11-02-1.md` C7 i `docs/reviews/E-02-2026-11-04-1.md` C4.
  - Sekcja „Root cause” w T-098 nie mówi, dlaczego istniejące testy nie złapały defektu.
  - `docs/architecture/architecture.md:24` (dostawca maili) wymienia w logu tylko `owner_alert_failed`. Błąd maila resetu ma od T-098 zdarzenie `password_reset_mail_failed`.
- **Expected:**
  - `pnpm lint` odrzuca wywołanie `.error(…)` na loggerze (`log`, `app.log`, `request.log`, `this.log`) w `apps/api/src/**` poza `src/logging.ts` i `src/http/api-error.ts`. Komunikat wskazuje `logFailure` / `bestEffort` i `backend.md`, „Pułapki”. Tak jak reguła `limit_reached` (T-035) i `API_AFTER_COMMIT_SYNTAX` (T-089).
  - Oba dokumenty są poprawione.

## Acceptance criteria

- [x] AC1: Given plik w `apps/api/src/**` poza wyjątkami, który woła `log.error(…)`, `app.log.error(…)` albo `request.log.error(…)`, when `pnpm lint`, then błąd `no-restricted-syntax` z komunikatem o `logFailure` / `bestEffort`. — verified by: fikstura w `scripts/test/lint-security.test.mjs`, czerwona przed zmianą
- [x] AC2: Given `src/logging.ts`, `src/http/api-error.ts` i wywołania `logFailure` / `bestEffort` w innych plikach, then brak błędu lintu. Obecne repo przechodzi `pnpm lint` bez zmian w kodzie produkcyjnym. — verified by: fikstura (przypadek dozwolony) + `pnpm check`
- [x] AC3: Reguła działa we wszystkich blokach `files` dla `apps/api/src/**`, także w nadpisaniach, które powtarzają listę `no-restricted-syntax` (`modules/*/http/**`, `http/web-app.ts`). — verified by: fikstura z plikiem w `modules/x/http/` + przegląd QA
- [x] AC4: T-098 „Root cause” ma zdanie o tym, dlaczego testy nie złapały defektu: przypinały ówczesne kształty (`source: "mailer"`, `error`), bo żadna reguła nie definiowała wspólnego kształtu. `architecture.md:24` wymienia też `password_reset_mail_failed`. `backend.md` „Pułapki” (punkt T-098) wskazuje regułę lintu. — verified by: przegląd QA
- [x] AC5: No regression in: T-098, T-089 (`API_AFTER_COMMIT_SYNTAX`), T-035 (`API_LIMIT_LOG_SYNTAX`); pozostałe przypadki `lint-security.test.mjs` zielone.

## TDD plan

**Seam:** ESLint na fiksturach, jak istniejące przypadki w `scripts/test/lint-security.test.mjs`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `request.log.error({ event: "x" }, "x")` w `apps/api/src/modules/x/http/routes.ts` → błąd z komunikatem o `logFailure` | unit | node:test (jak `lint-security.test.mjs`) | AC1, AC3 |
| 2 | `app.log.error(...)` / `log.error(...)` w `apps/api/src/x.ts` → błąd | unit | jak wyżej | AC1 |
| 3 | `logFailure(log, "x", error)` w `apps/api/src/x.ts` i `log.error(...)` w `src/logging.ts` → brak błędu | unit | jak wyżej | AC2 |

**Run:** `node --test scripts/test/lint-security.test.mjs` oraz `pnpm check`

## QA plan

- **Regression:** `pnpm check`; przypadki T-035 i T-089 w `lint-security.test.mjs`.
- **Edge cases:** `log["error"](…)`; logger w zmiennej o innej nazwie (`logger.error`): opisać decyzję, czy reguła łapie dowolny obiekt kończący się na `log`, czy listę nazw; `console.error` (obejmuje go już inna reguła, czy nie: sprawdzić); `warn` poza zakresem (QA T-098, uwaga 5).
- **Platforms:** API, CI (Node na Windows i Linux).

## Root cause

Kształt wpisu błędu po zapisie i w tle (T-098) był tylko konwencją w `backend.md`, „Pułapki”. Lint pilnował już kształtu zdarzeń limitu (T-035) i `afterCommit` (T-089), ale nie `log.error`, więc nowe miejsce mogło znów napisać własny kształt.

## Evidence

Kod: `eslint.config.js` — `API_FAILURE_LOG_SYNTAX` (selektor `CallExpression` z metodą `error` — `.error` albo `["error"]` — na obiekcie, którego nazwa albo ostatnia właściwość kończy się na `log` / `logger`, bez rozróżniania wielkości liter). Dodana do każdego bloku `no-restricted-syntax` dla `apps/api/src/**`: blok główny API, `modules/*/http/**`, `http/web-app.ts`, `db/schema.ts` i nowy blok `http/rate-limit.ts` (był wyłączony z bloku głównego ze względu na `API_LIMIT_LOG_SYNTAX`, więc bez niego zostałby luką). Wyjątki: `src/logging.ts` (wyłączony już z bloku głównego) i nowy blok `src/http/api-error.ts`, który powtarza listę bez nowej reguły. Kod produkcyjny bez zmian.

TDD (`node scripts/test/lint-security.test.mjs`; fikstury przez `lintText` pod nazwą istniejącego pliku):

| # | Test | Red (przed zmianą) | Teraz |
| --- | --- | --- | --- |
| 1 | `request.log.error w trasie modułu (modules/listy/http/routes.ts)` | `FAIL … brak błędu no-restricted-syntax z logFailure; są: [no-unused-vars …]` | ok |
| 2 | `log.error w pliku API (modules/listy/infra/lists-repository.ts)` | `FAIL … brak błędu no-restricted-syntax z logFailure` (selektor łapał wtedy tylko `x.log.error`) | ok |
| 2 | `app.log.error w pliku API` | zielony od razu po zmianie z testu 1 (ten sam selektor `object.property`) | ok |
| 3 | dozwolone: `logFailure i bestEffort w pliku API` (z `log.warn`), `log.error w logging.ts`, `request.log.error w handlerze błędów (api-error.ts)` | spot-check: blok `api-error.ts` przestawiony na inny plik → `FAIL request.log.error w handlerze błędów` | ok |
| dod. | `log["error"]`, `logger.error`, `this.log.error`, `request.log.error w web-app.ts`, `log.error w schema.ts` | gałęzie selektora / bloki dodane przed fiksturą, więc sprawdzone, że gryzą: bez gałęzi `value='error'` → `FAIL log["error"]…`; bez reguły w bloku `web-app.ts` → `FAIL request.log.error w web-app.ts`; bez reguły w bloku `schema.ts` → `FAIL log.error w schema.ts`; konfiguracja przywrócona | ok |
| dod. | `log.error w rate-limit.ts` (luka znaleziona przy przeglądzie bloków, dopisana do planu) | `FAIL … brak błędu no-restricted-syntax z logFailure` | ok |

Wynik: 53 × `ok`, 0 × `FAIL` (w tym wszystkie przypadki T-035, T-089, TH-15/16/20 i kontrola SAFE_SYNTAX w każdym bloku, także w nowych).

Kryteria:

- AC1: testy 1, 2 i `log["error"]` / `logger.error` / `this.log.error` (komunikat zawiera `logFailure`, `bestEffort`, `T-098`, `TH-21`, `layers/backend.md „Pułapki”`).
- AC2: przypadki dozwolone z testu 3; `pnpm check` exit 0 (format, lint całego repo, typecheck, quality, design/backlog/workflow-check, 1242 testy vitest, 10 jest) bez zmian w kodzie produkcyjnym; `pnpm build` exit 0.
- AC3: fikstury w `modules/listy/http/routes.ts`, `http/web-app.ts`, `db/schema.ts`, `http/rate-limit.ts` i pliku z bloku głównego; spot-checki wyżej.
- AC4: `T-098` „Root cause” — zdanie o testach przypinających `source: "mailer"` i `error`; `architecture.md:24` — `password_reset_mail_failed` dla maila resetu; `backend.md` „Pułapki” (punkt T-098) — reguła `API_FAILURE_LOG_SYNTAX`, nazwy loggerów i wyjątki; wiersz w historii zmian `backend.md`.
- AC5: pełny przebieg `lint-security.test.mjs` zielony; `pnpm check` zielony (testy T-098 w vitest).

Decyzje do przeglądu QA (plan QA, przypadki brzegowe):

- Nazwy loggera: wzorzec `/log(ger)?$/i` na nazwie obiektu albo jego ostatniej właściwości, nie zamknięta lista — łapie też `childLog`, `requestLog`, `reply.log`, `fastify.log`. Koszt: obiekt o nazwie typu `catalog` / `dialog` z metodą `error` też by padł; w `apps/api/src` takiego nie ma.
- Nie łapie: ``log[`error`]`` (szablon), przypisania metody do zmiennej (`const e = log.error`), destrukturyzacji. Uznane za świadome obejście, nie przypadek do pilnowania.
- `console.error`: żadna reguła go dziś nie obejmuje (w `eslint.config.js` brak `no-console`); w `apps/api/src` jest tylko `console.log` w `db/migrate-cli.ts` (CLI migracji, poza loggerem). Poza zakresem tego zadania; ewentualnie osobny fix.
- `warn` poza zakresem (QA T-098, uwaga 5).
- `node --test scripts/test/lint-security.test.mjs` (z planu) też działa, ale ukrywa wypis `ok/FAIL`; CI uruchamia `node scripts/test/lint-security.test.mjs` (`ci.yml:113`), a filtr ścieżek CI obejmuje już `eslint.config.js`.

## Prevention

To zadanie jest prewencją dla klasy T-098 (przegląd E-02, C7 / C4).

## Incident note

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-06)

Verdict: pass

Reprodukcja: `pnpm install --frozen-lockfile && pnpm check && pnpm build` exit 0 (lint, typecheck, quality, design/backlog/workflow-check, vitest 154 plików / 1242 testy, jest 10); `node scripts/test/lint-security.test.mjs` — wszystkie przypadki `ok`, w tym T-035, T-089, TH-15/16/20 i SAFE_SYNTAX w każdym bloku (AC5). Wyszukanie `.error(` w `apps/api/src`: tylko `logging.ts:213` i `http/api-error.ts:81,104` (AC2).

Kryteria: AC1 pass, AC2 pass, AC3 pass, AC4 pass (przegląd `T-098` „Root cause”, `architecture.md:24`, `backend.md` „Pułapki” i historia zmian), AC5 pass.

Spot-checki (przywrócone `git checkout -- eslint.config.js`, `git status` czysty):
- selektor `API_FAILURE_LOG_SYNTAX` zneutralizowany → 9 × `FAIL` (wszystkie przypadki odrzucane T-101), przypadki dozwolone dalej `ok`;
- reguła zdjęta tylko z bloku `modules/*/http/**` → `FAIL request.log.error w trasie modułu` (AC3 gryzie per blok).

Eksploracja (`lintText` na plikach API): łapie `log?.error`, `request.log?.error`, `request.server.log.error`, `LOG.error`, pliki `cleanup/index.ts` i `owner-alerts.ts`; przepuszcza `log.warn`, `log.info`.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | lint / zakres reguły | `.error` na loggerze potomnym nie jest łapany: obiekt wywołania to `CallExpression`, więc nie ma `name` ani `property.name`. Wzorzec jest realny w tym repo (`securityLog` w `logging.ts:118` zwraca `log.child(…)`). Decyzja nie jest opisana w „Decyzje do przeglądu QA”, a plan QA o to prosił. | `log.child({}).error("x")`, `request.log.child({ a: 1 }).error("x")` w `lists-repository.ts` / `modules/listy/http/routes.ts` → brak `no-restricted-syntax` | Dopisać do selektora gałąź `callee.object.type='CallExpression'` z `callee.object.callee.property.name='child'` (albo `securityLog`) albo opisać świadome pominięcie w `backend.md` „Pułapki”. |
| 2 | note | lint / zakres reguły | `log.fatal(…)` (level 60) i `(log as T).error(…)` też omijają wspólny kształt. `fatal` nie występuje w `apps/api/src`. | eksploracja `lintText` → brak błędu | Można rozszerzyć `ERROR_METHOD` o `fatal` przy okazji punktu 1. |
| 3 | note | lint | `console.error` nie obejmuje żadna reguła (brak `no-console`), co autor zgłosił. W `apps/api/src` występuje tylko `console.log` w CLI migracji. | eksploracja: `console.error(error)` → brak błędu | Osobny fix, jeśli właściciel chce: `no-console` w `apps/api/src/**` z wyjątkiem `db/migrate-cli.ts`. |
| 4 | note | lint / konfiguracja | Po dodaniu bloku `rate-limit.ts` ogólny blok `apps/api/src/**` (SAFE+CLOCK+RAW_URL, eslint.config.js:354) działa już tylko dla `logging.ts`, ale komentarz tego nie mówi. | `eslint.config.js:353-359` | Opcjonalnie: zawęzić blok do `logging.ts` albo uzupełnić komentarz. |

Fix: „Root cause” mówi, dlaczego nic tego nie łapało (tylko konwencja w dokumencie, brak przypadku w `lint-security.test.mjs`). Brak czerwonego testu przed zmianą został pokazany w Evidence (testy 1, 2 i `rate-limit.ts`), a spot-check potwierdza, że przypadki padają bez reguły.
