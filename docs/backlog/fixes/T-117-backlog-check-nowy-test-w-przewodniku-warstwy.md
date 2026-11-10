---
id: T-117
title: "backlog-check: nowy plik testu w warstwie wymaga wiersza zadania w przewodniku tej warstwy"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa          # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [infra]
requirements: []
threats: []
screens: []
related_tasks: [T-110, T-112, T-113, T-115]
---

# T-117 backlog-check: nowy plik testu w warstwie wymaga wiersza zadania w przewodniku tej warstwy

## Report

Źródło: propozycja prewencji z QA T-115, runda 1 (uwaga 2), zgłoszona drugi raz (wcześniej przy T-110, T-112, T-113). Właściciel 2026-11-10: osobne zadanie. Gałąź: `epic/E-02-konto-i-uczestnicy` albo `fix/T-117-…` z `main` po scaleniu epiku (`git-workflow.md`, „Fixes”).

- **Actual:** zadanie, które dodaje nowy test albo nową bramkę w warstwie (np. `apps/api/test/reset-mail.copy.test.ts` w T-115), może przejść `pnpm check` bez wpisu w „Pułapkach” i bez wiersza w historii zmian przewodnika tej warstwy (`docs/architecture/layers/<warstwa>.md`). Brak wpisu wychwytuje dopiero QA albo nikt.
- **Expected:** `scripts/backlog-check.mjs` zgłasza zadanie (status `in-qa` albo `done`), które w swoich commitach dodało plik `*.test.ts` w katalogu warstwy z `layers:`, a historia zmian przewodnika tej warstwy nie ma wiersza z ID zadania. Źródło: propozycja QA T-115, decyzja właściciela 2026-11-10.
- **Steps to reproduce:** commit T-115 `0c719f4` dodał `apps/api/test/reset-mail.copy.test.ts` (warstwa backend), a `backend.md` nie miał wiersza T-115 aż do poprawki po QA; `pnpm check` był zielony.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy`.
- **Evidence:** QA T-115 runda 1, uwaga 2 (`docs/backlog/fixes/T-115-dopiski-zlozony-z-czesci-i-mail-z-api-sprawdzane.md`).

## Do ustalenia przy realizacji

- Jak wiązać pliki z zadaniem: commity z prefiksem `T-NNN:` (`git log`) czy lista plików w zadaniu. W CI potrzebna pełna historia (`fetch-depth`).
- Mapowanie katalogów na warstwy (`apps/api` → backend, `apps/web` → web, `apps/mobile` → mobile, migracje → db, `scripts/` i `.github/` → infra).
- Czy sam nowy plik testu wystarcza, czy też nowy `describe` w istniejącym pliku (ryzyko fałszywych alarmów); czy reguła dotyczy tylko zadań po dacie wprowadzenia (zadania historyczne bez wierszy).
- Czy ostrzeżenie, czy błąd.

**Ustalone (/fix, 2026-11-10):**

- **Powiązanie:** commity z tematem `T-NNN: …` (`git log HEAD --no-merges -M --diff-filter=A`); zadania nie mają wiarygodnej listy plików. Job `always` w CI dostał `fetch-depth: 0`; w płytkim klonie reguła daje ostrzeżenie zamiast cicho przechodzić, a poza repozytorium git jest pomijana (fikstury bez git).
- **Mapowanie:** dane, nie kod — frontmatter `paths:` w każdym przewodniku (prefiksy względem korzenia repo): backend `apps/api/`, `packages/shared/`; db `apps/api/drizzle/`, `apps/api/src/db/`, `apps/api/test/`; web `apps/web/`, `packages/shared/`, `packages/tokens/`; mobile `apps/mobile/`, `packages/shared/`, `packages/tokens/`; infra `scripts/`, `.github/`. Przewodnik bez `paths:` nie jest sprawdzany. Plik pod kilkoma warstwami zadania: wystarczy wiersz w jednym z ich przewodników. Plik w katalogu warstwy spoza `layers:` zadania nie jest zgłaszany.
- **Co liczy się jako nowy test:** tylko dodany plik `*.test.*` / `*.spec.*` (js/ts/jsx/tsx/mjs/cjs) albo `*.test.sh`; nowy `describe` w istniejącym pliku i zmiana nazwy pliku nie (bez fałszywych alarmów). Wiersz liczy się tylko w sekcji „## Historia zmian” (albo „Change log”/„History”).
- **Zadania historyczne:** tylko commity od `2026-11-10T00:00:00+01:00` (bez granicy repo dawałoby 54 błędy dla zadań sprzed reguły). Statusy `in-qa` i `done`.
- **Waga:** błąd (kod wyjścia 1), jak reguły T-110: `pnpm check` i CI mają zatrzymać zadanie przed QA.
- `mobile.md` nie miał „Historia zmian” — dodana sekcja z wierszem T-117.

## Acceptance criteria

- [ ] AC1: Given zadanie `in-qa`/`done`, którego commity dodały `*.test.ts` w warstwie z `layers:`, a przewodnik warstwy nie ma wiersza historii zmian z ID zadania, when uruchamia się `backlog-check`, then zgłasza zadanie, plik i przewodnik. — verified by: test `backlog-check` z fikstury
- [ ] AC2: Given ten sam przypadek z wierszem w historii zmian przewodnika, then brak zgłoszenia. — verified by: fikstura
- [ ] AC3: Given repo, then `backlog-check` jest zielony (zadania sprzed reguły zgodnie z decyzją z „Do ustalenia”). — verified by: `pnpm check`
- [ ] AC4: Given `docs/architecture/layers/infra.md`, then opisuje regułę, a historia zmian ma wiersz T-117. — verified by: odczyt
- [ ] AC5: No regression in: T-099, T-102, T-110, T-116.

## TDD plan

**Seam:** funkcja sprawdzania w `scripts/backlog-check.mjs` z fikstur (historia commitów i przewodniki jako dane wejściowe).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | nowy test w warstwie bez wiersza w przewodniku → zgłoszenie | unit | Vitest | AC1 |
| 2 | nowy test z wierszem w przewodniku → brak zgłoszenia | unit | Vitest | AC2 |

## QA plan

- **Regression:** `backlog-check` na repo, CI.
- **Edge cases:** zadanie z kilkoma warstwami, plik testu w `apps/*/src` (testy web), zadanie bez commitów, zmiana nazwy pliku testu.
- **Platforms:** lokalnie i CI.

## Root cause

`backlog-check` sprawdzał tylko pliki backlogu; nic nie łączyło plików dodanych w commitach zadania z przewodnikiem warstwy, więc wiersz w „Historia zmian” zależał wyłącznie od pamięci implementującego i od QA (T-110, T-112, T-113, T-115). Testy nie mogły tego złapać, bo reguły nie było — zabrakło sprawdzenia, nie przypadku testowego. Przy realizacji wyszedł drugi błąd: `git log --since=2026-11-10` (sama data) git czyta jako „tego dnia o bieżącej godzinie”, więc pierwsza wersja pomijała commity T-115 z rana; granica jest teraz pełnym znacznikiem czasu, a test „data graniczna … 00:30” to pilnuje.

Ten sam wzorzec gdzie indziej: brak — inne sprawdzenia `backlog-check` nie czytają historii git.

## Evidence

- **Red:** `node --test scripts/test/backlog-check.test.mjs` — „commit zadania in-qa dodał test w warstwie, przewodnik bez wiersza → błąd … (T-117 AC1)”: `AssertionError: … actual: 0, expected: 1` (kod wyjścia `backlog-check` 0 mimo braku wiersza).
- **Green:** 31/31 testów `backlog-check` (8 nowych T-117: AC1, AC2, kilka warstw, `apps/web/src` i `*.spec.ts`, przypadki bez zgłoszenia, zmiana nazwy, data graniczna, ID poza „Historia zmian”, płytki klon); `pnpm check` zielony (156 plików, 1278 testów); actionlint 1.7.12 bez uwag.
- **Rzeczywisty przypadek:** worktree na `0c719f4` (T-115 `in-qa`, `backend.md` z `paths:`) → `ERROR …T-115….md: commits of T-115 added test apps/api/test/reset-mail.copy.test.ts, but docs/architecture/layers/backend.md has no row with T-115 under "## Historia zmian"`. Obecne repo: bez zgłoszeń.

## Prevention

Ta reguła jest prewencją: przewodnik warstwy nadąża za nowymi testami i bramkami bez polegania na QA.

<!-- QA rounds are appended below by /qa-task -->
