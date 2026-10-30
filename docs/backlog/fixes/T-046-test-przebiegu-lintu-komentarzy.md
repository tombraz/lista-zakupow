---
id: T-046
title: "Stały test przebiegu lintu komentarzy (`eslint.directives.config.js`) na obejściach z T-045"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done                  # todo | in-progress | in-qa | done | blocked
depends_on: [T-045]
layers: [infra]
requirements: []
threats: [TH-21]
screens: []
related_tasks: [T-030, T-044, T-045]
---

# T-046 Stały test przebiegu lintu komentarzy (`eslint.directives.config.js`) na obejściach z T-045

## Report

Źródło: T-045, QA runda 2 (propozycja), zaplanowane przez `/plan-backlog` 2026-10-30 na prośbę właściciela.

- **Actual:** T-045 zamknął komentarze wyłączające i konfiguracyjne drugim przebiegiem `pnpm lint`: `eslint -c eslint.directives.config.js --no-inline-config`. Obejścia sprawdzono tylko na jednorazowych plikach próbnych, które potem usunięto. Nic nie pilnuje, że przebieg dalej je łapie. Wystarczy usunąć `--no-inline-config` ze skryptu `lint`, wyrzucić `eslint-comments/*` z `no-restricted-disable` albo zawęzić `files`, a `pnpm lint` na repo dalej jest zielony. Luka wraca po cichu, jak w T-030 → T-044 → T-045.
- **Expected:** stały test w CI uruchamia przebieg komentarzy tak jak `pnpm lint` na znanych obejściach i pada, gdy którekolwiek przejdzie albo gdy dozwolony komentarz zostanie odrzucony. Źródło: T-045 AC1/AC2 i „Prevention”, `CODING_STANDARDS.md` wiersz „Wyjątki od reguł z przeglądów”.
- **Steps to reproduce:**
  1. W `package.json` usuń z `lint` `--no-inline-config`.
  2. `pnpm lint` i `pnpm test` są zielone, a `/* eslint eslint-comments/no-use: off, no-restricted-syntax: off */` w `apps/api/src` przechodzi.
- **Environment:** lokalnie / CI; `4da53b9`.

## Acceptance criteria

- [x] AC1: Given każde obejście z listy poniżej, when test uruchomi przebieg komentarzy z ustawieniami `pnpm lint` (konfiguracja, `--no-inline-config`, `--max-warnings 0`) na pliku o ścieżce w zakresie (`apps/api/src`, `apps/web/src`, `apps/web/test`, `packages/shared/src`, także `.tsx`), then przebieg kończy się błędem z oczekiwaną regułą (`eslint-comments/no-use` albo `eslint-comments/no-restricted-disable`). Obejścia:
  1. `/* eslint eslint-comments/no-use: off, no-restricted-syntax: off */` nad ręcznym `log.warn({ event: "rate_limited" })`,
  2. `/* eslint-disable eslint-comments/no-use */` nad `/* eslint no-restricted-syntax: off */`,
  3. `/* eslint-disable */` bez nazwy reguły,
  4. `// eslint-disable-next-line no-restricted-syntax` (oraz `no-restricted-imports`),
  5. `// eslint-disable-next-line eslint-comments/no-restricted-disable`,
  6. `/* eslint no-restricted-syntax: ["error"] */`, `/* global foo */`, `/* globals bar */`, `/* eslint-env node */`, `/* exported baz */`. — verified by: test
- [x] AC2: Given dozwolony `// eslint-disable-next-line react-hooks/exhaustive-deps` (jak w `Modal.tsx`), when test uruchomi ten sam przebieg, then exit 0 bez ostrzeżeń. — verified by: test
- [x] AC3: Test bierze polecenie przebiegu ze skryptu `lint` w `package.json`, nie z własnej kopii. Usunięcie `--no-inline-config` ze skryptu albo `eslint-comments/*` z `no-restricted-disable` sprawia, że test pada. — verified by: QA (mutacja ręczna, cofnięta)
- [x] AC4: Test działa w CI w jobie, który ma zainstalowane zależności (`static`), i uruchamia się także przy zmianie samego testu lub `eslint.directives.config.js` (filtr ścieżek w `.github/workflows/ci.yml`). — verified by: `node scripts/workflow-check.mjs`, actionlint, przegląd diffu
- [x] AC5: No regression in: `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm quality`, `bash scripts/test/workflow-check.test.sh`.

## TDD plan

**Seam:** przebieg `eslint.directives.config.js` uruchamiany jak w `pnpm lint`, na treści podanej przez `--stdin --stdin-filename <ścieżka w zakresie>` (bez plików w drzewie, więc nic nie trzeba sprzątać i `pnpm lint` na repo ich nie widzi).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `scripts/test/lint-directives.test.sh`: dla każdego obejścia z AC1 exit ≠ 0 i nazwa oczekiwanej reguły w wyjściu; najpierw uruchomiony bez `--no-inline-config` (obejścia 1, 2 przechodzą → test pada, czerwone), potem z poleceniem ze skryptu `lint` (zielone) | script | bash (wzór `scripts/test/workflow-check.test.sh`: `check`, `status_of`) | AC1, AC3 |
| 2 | ten sam skrypt: dozwolony `eslint-disable-next-line react-hooks/exhaustive-deps` w `apps/web/src/*.tsx` → exit 0 | script | bash | AC2 |
| 3 | krok w jobie `static` w `ci.yml` + wpis w filtrze `all`; `node scripts/workflow-check.mjs`, actionlint | ci | workflow-check, actionlint | AC4 |

**Run:** `bash scripts/test/lint-directives.test.sh`

Wskazówki:
- Polecenie przebiegu wyciągnąć ze skryptu `lint` (część po `&&`, np. `node -p "require('./package.json').scripts.lint"`) i dołożyć `--stdin --stdin-filename …`; inaczej test przechodzi na własnej kopii, gdy skrypt się zmieni (AC3).
- Job `infra` (gdzie są pozostałe `scripts/test/*.test.sh`) nie instaluje zależności, dlatego test idzie do `static` (ma `./.github/actions/setup`). Filtr `static` nie obejmuje `scripts/**`, więc `scripts/test/lint-directives.test.sh` dopisać do `all` (jak `eslint.directives.config.js` w T-045).
- Ścieżki w `--stdin-filename` nie muszą istnieć; ESLint dopasowuje `files` po nazwie.

## QA plan

- **Regression:** `pnpm lint` na repo zielony (oba przebiegi); pozostałe testy skryptów w jobie `infra` bez zmian.
- **Edge cases:** mutacje z AC3 cofnięte po sprawdzeniu; plik `.tsx` w `packages/shared/src`; ścieżka poza zakresem (np. `apps/web/e2e/x.ts`) — test jej nie wymaga, ale nie powinien twierdzić, że jest objęta; wyjście ESLint na Windows (Git Bash) i Linux (CI) — porównanie po nazwie reguły, nie po pełnej linii.
- **Platforms:** CI (ubuntu), lokalnie Windows / Git Bash.

## Root cause

T-045 zabezpieczył przebieg komentarzy tylko konfiguracją (`--no-inline-config` w skrypcie `lint`, lista w `no-restricted-disable`, `files`), a obejścia sprawdził na jednorazowych plikach, które potem usunął. W repo nie ma kodu z zakazanymi komentarzami, więc `pnpm lint` jest zielony niezależnie od tego, czy przebieg je łapie. Osłabienie przebiegu niczego nie wywraca. Ten sam wzorzec (sprawdzenie raz, bez stałego testu) wystąpił w T-030 → T-044 → T-045; innych przebiegów lintu bez testu nie ma (`eslint.config.js` jest pilnowany przez kod w repo).

## Evidence

- **Test:** `bash scripts/test/lint-directives.test.sh`: 12 obejść z AC1 (wszystkie zakresy `files`, `.ts` i `.tsx`), dozwolony komentarz z AC2, kontrola, że skrypt `lint` ma przebieg `eslint.directives.config.js`. Polecenie pochodzi ze skryptu `lint` (część po ostatnim `&&`) + `--stdin --stdin-filename`.
- **Czerwony** (skrypt `lint` bez `--no-inline-config`, mutacja z kroków reprodukcji, cofnięta): `FAIL 1. komentarz konfiguracyjny wyłącza no-use i no-restricted-syntax (apps/api/src/x.ts)`, oczekiwane `1 eslint-comments/no-use`, jest `0`; `FAIL dozwolony eslint-disable-next-line react-hooks/exhaustive-deps`, oczekiwane `0`, jest `1`; exit 2.
- **Mutacje AC3 (cofnięte):** bez `"eslint-comments/*"` w `no-restricted-disable` → `FAIL 2. … (apps/api/src/x.ts)`; `files` bez `apps/web/test` i bez `.tsx` → 6× FAIL (przypadki `.tsx` i `apps/web/test`).
- **Zielony:** 14× `ok`, exit 0 (~18 s lokalnie, Windows / Git Bash).
- **CI:** krok „Lint komentarzy łapie obejścia (T-046)” w jobie `static`, `scripts/test/lint-directives.test.sh` w filtrze `all`. `node scripts/workflow-check.mjs` OK, actionlint 1.7.12 exit 0.
- **Regresja:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm quality`, `bash scripts/test/workflow-check.test.sh` zielone; `pnpm test`: 93 pliki, 515 testów, wszystkie zielone. `shellcheck` niedostępny lokalnie (komentarz `SC2086` przy celowym dzieleniu polecenia na słowa).
- **Uwaga dla QA:** dozwolony komentarz poza zakresem `files` daje exit 1 („File ignored”, `--max-warnings 0`), więc przypadek AC2 przy okazji potwierdza, że `apps/web/src/*.tsx` jest objęty.

## Prevention

Sam test jest zabezpieczeniem pierwszego rzędu (sprawdzenie, które pada automatycznie): osłabienie przebiegu komentarzy (flaga, lista reguł, `files`) wywraca CI w jobie `static`. Przy kolejnej bramce lintu, której w repo nic nie narusza, potrzebny jest taki sam test na znanych obejściach. Propozycja wpisu do „Pułapek” w `infra.md` czeka na decyzję właściciela.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-10-30)

Verdict: pass

Kryteria akceptacji:

- **AC1 — pass.** `bash scripts/test/lint-directives.test.sh` (Git Bash, Windows): 14× `ok`, exit 0, ~47 s. Wszystkie 6 grup obejść, wszystkie zakresy `files`, `.ts` i `.tsx`. Ręcznie: plik `apps/api/src/qa-t046-probe.ts` z obejściem 1 → `pnpm lint` exit 1 (plik usunięty).
- **AC2 — pass.** Przypadek dozwolonego `react-hooks/exhaustive-deps` w `apps/web/src/x.tsx` → `0 ` (exit 0, brak reguł).
- **AC3 — pass.** Polecenie pochodzi z `scripts.lint` (`split('&&').pop()`). Mutacje (każda cofnięta, `git status` czysty): bez `--no-inline-config` → FAIL obejście 1 i AC2, exit 2; bez `"eslint-comments/*"` → FAIL obejście 2 (`apps/api/src`), exit 1; `packages/*/src` bez `.tsx` → FAIL obejście 5, exit 1; bez `"no-restricted-imports"` → FAIL obejście 4 (imports), exit 1.
- **AC4 — pass.** Krok w jobie `static` po `./.github/actions/setup`; ścieżka testu w filtrze `all` (więc `static` rusza przy zmianie samego testu). `node scripts/workflow-check.mjs` OK. actionlint niedostępny lokalnie — sprawdzone przeglądem diffu (dwie linie `name`/`run`, poprawne YAML).
- **AC5 — pass.** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm quality`, `bash scripts/test/workflow-check.test.sh` zielone. `pnpm test`: 93 pliki, 515 testów zielone (jeden z trzech przebiegów miał 6 niestabilnych porażek w testach ekranów web, patrz #3).

Fix task: „Root cause” wyjaśnia, czemu nic nie łapało osłabienia (brak kodu z zakazanymi komentarzami w repo). Test pada bez poprawki (mutacje wyżej), czerwony udokumentowany w Evidence.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | test | `lint()` wyciąga nazwy reguł `grep -oE 'eslint-comments/[a-z-]+'` z całego wyjścia, także z treści komunikatu. Komunikat `no-restricted-disable` zawiera nazwę wyłączanej reguły, więc przypadek „2. … (apps/web/src/x.tsx)” (oczekiwane `no-use`) przeszedłby także bez zgłoszenia `no-use`. | `1:19 error Disabling 'eslint-comments/no-use' is not allowed eslint-comments/no-restricted-disable` | dopasowanie tylko do kolumny ruleId (koniec linii) albo `--format json` i `ruleId`; pozostałe przypadki (1, 6) i tak łapią wyłączenie `no-use`, stąd minor |
| 2 | note | test | Polecenie ze skryptu dzielone na słowa bez obsługi cudzysłowów; argument w cudzysłowie w `scripts.lint` rozbije polecenie. Dziś brak takich argumentów, a awaria byłaby głośna (exit ≠ 1). | `$lint_cmd --stdin …` (SC2086) | ewentualnie `pnpm exec`/`sh -c` z dołożonymi argumentami |
| 3 | note | testy web (poza zakresem) | Pełne `pnpm test` raz dało 6 porażek w `SignUpScreen`, `ListScreen(.edit)`, `ParticipantsScreen`; te pliki osobno 123/123, ponowny pełny przebieg 515/515. Niestabilność pod obciążeniem, niezwiązana z T-046. | `Test Files 4 failed | 89 passed (93)`, potem `93 passed` | osobny task na stabilność testów ekranów (timeouty / jsdom) |
| 4 | note | narzędzia | actionlint i shellcheck niedostępne lokalnie; AC4 sprawdzone `workflow-check` i przeglądem. | `command -v actionlint` → brak | — |

### Po QA round 1

Uwaga #1 (minor) poprawiona w `lint()`: reguły brane tylko z ostatniej kolumny wiersza zgłoszenia (`awk '{print $NF}'`, bez ``). Czerwony: mutacja `no-use` z `allow: [..., "eslint"]` przy starej wersji → przypadek „2. … (apps/web/src/x.tsx)” `ok` (fałszywie); po poprawce `FAIL`. Bez mutacji 14× `ok`, exit 0. Uwagi #2 i #4 bez zmian (note). Uwaga #3: niestabilne testy ekranów web pod obciążeniem, propozycja osobnego tasku.
