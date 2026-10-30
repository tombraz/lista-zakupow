---
id: T-046
title: "Stały test przebiegu lintu komentarzy (`eslint.directives.config.js`) na obejściach z T-045"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa                 # todo | in-progress | in-qa | done | blocked
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

<!-- QA rounds are appended below by /qa-task -->
