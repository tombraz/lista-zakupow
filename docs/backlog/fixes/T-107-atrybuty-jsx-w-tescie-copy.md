---
id: T-107
title: "Test Copy: jednowyrazowe teksty w atrybutach JSX (`aria-label`, `title`, `alt`, `placeholder`) w `.tsx` modułu wspólnego"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done                # todo | in-progress | in-qa | done | blocked
depends_on: [T-106]
layers: [web]
requirements: []
threats: []
screens: []
related_tasks: [T-100, T-103, T-106]
---

# T-107 Test Copy: jednowyrazowe teksty w atrybutach JSX w `.tsx` modułu wspólnego

## Report

Źródło: QA T-106, runda 1, uwaga minor #2 (właściciel 2026-11-06: osobny task). Gałąź: `epic/E-02-konto-i-uczestnicy` albo `fix/T-107-…` z `main` po scaleniu epiku (`git-workflow.md`, „Fixes”).

- **Actual:** `sharedTsxTexts()` w `apps/web/test/copyRegister.ts` zgłasza każdy tekst JSX z literą (T-106), ale literał w atrybucie JSX nadal przechodzi przez `looksLikeText`. Dlatego jednowyrazowy tekst bez polskiej litery w atrybucie dostępności (`aria-label="Zamknij"`, `title="Menu"`) w `.tsx` modułu wspólnego nie jest zgłaszany i omija rejestr Copy. Dziś w `components/` takich atrybutów nie ma (grep QA).
- **Expected:** atrybuty, które trafiają do użytkownika albo do czytnika ekranu (`aria-label`, `aria-description`, `title`, `alt`, `placeholder`), są traktowane jak tekst JSX: każda wartość z literą jest błędem ze wskazaniem pliku. Inne atrybuty (`className`, `type`, `role`, `id`) nie są tekstem.
- **Steps to reproduce:** w `components/Modal/Modal.tsx` (albo innym `.tsx` modułu wspólnego) dopisać `<span aria-label="Zamknij" />` i uruchomić `pnpm vitest run --project web copyRegister`: test przechodzi.
- **Environment:** lokalnie, gałąź `epic/E-02-konto-i-uczestnicy` po T-106 (`f82e372`).

## Acceptance criteria

- [x] AC1: Given plik `.tsx` modułu wspólnego (poza `screens/`) z atrybutem `aria-label`, `aria-description`, `title`, `alt` albo `placeholder`, którego wartość to literał z literą (także jednowyrazowy, bez polskiej litery), when uruchamia się test zgodności Copy, then test jest czerwony ze wskazaniem pliku i tekstu. — verified by: test jednostkowy `copyRegister` z fixture
- [x] AC2: Given atrybuty niebędące tekstem (`className`, `type`, `role`, `id`, `data-*`), then nie są zgłaszane. — verified by: ten sam fixture
- [x] AC3: Zakres w nagłówku `copyRegister.test.ts` i w `web.md` („Pułapki”) jest zgodny z testem.
- [x] AC4: No regression in: test zgodności Copy na repo (zielony), T-100, T-103, T-106.

## Root cause

`ModuleGraph.sharedTsxTexts()` (T-106) uznaje bez warunku za tekst tylko węzły `JsxText`; literał atrybutu JSX trafia do ogólnej ścieżki `literals(…).filter(looksLikeText)`, która wymaga polskiej litery albo dwóch słów (bo literał w `.tsx` bywa klasą lub typem). `aria-label="Zamknij"` nie ma ani jednego, więc przechodzi. Istniejące fixture T-106 sprawdzały tekst JSX (`<span>Zamknij</span>`) i atrybut nietekstowy (`className`, `type`), ale żadnego atrybutu dostępności.

Ten sam wzorzec gdzie indziej: teksty w `.tsx` katalogów ekranów (`screens/`) są nadal poza testem — znane ograniczenie zapisane w nagłówku testu i w `web.md`, nie ta sama poprawka. Wyrażenie inne niż literał w atrybucie (`title={cond ? "A" : "B"}`) idzie dalej ścieżką `looksLikeText` — poza zakresem AC.

## Fix

`apps/web/test/copyRegister.ts`: `TEXT_ATTRIBUTES` (`aria-label`, `aria-description`, `title`, `alt`, `placeholder`) i `textAttributeValue()` — literał (`"…"`, `{"…"}`, `` {`…`} ``) w takim atrybucie dołącza do tekstów JSX, więc każda wartość z literą jest błędem ze wskazaniem pliku. Opis zakresu: komentarz `sharedTsxTexts`, nagłówek `copyRegister.test.ts`, `web.md` „Pułapki” + historia zmian.

## Evidence

- Test odtwarzający: `findCopyGaps (fixtures) > a text in a user-facing JSX attribute of a shared .tsx file is an error, also one word (T-107)` (fixture `components/Modal/Modal.tsx`: `aria-label="Zamknij"`, `title="Menu"`, `alt={"Logo"}`, `placeholder="Szukaj"`, `aria-description="Opis"`; nietekstowe `role`, `id`, `className`, `data-testid`, `aria-labelledby`, `type`, `src` z wielkiej litery; puste `aria-label=""` i `title="…"`).
- Czerwony przed poprawką: `AssertionError: expected [Function check] to throw an error`.
- Po poprawce: `copyRegister.test.ts` 18/18 (w tym test na repo — zielony, w `components/` nie ma takich atrybutów).
- `pnpm test`: 1260 testów, 0 błędów; `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build` — czyste.

## Regression

- Test zgodności Copy na repo (SC-01–SC-09) — zielony.
- T-100 (rejestr Copy), T-103 (tekst w `.tsx` modułu wspólnego), T-106 (`components/`, Copy komponentów) — ich fixture w `copyRegister.test.ts` bez zmian, zielone.

## Prevention

Domknięcie klasy z T-103/T-106: tekst w `.tsx` modułu wspólnego nie może ominąć rejestru Copy przez położenie w atrybucie. Sama poprawka jest kontrolą automatyczną (test); `web.md` „Pułapki” opisuje zakres.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-06)

Verdict: pass

Zakres: commit `d5767ac`. Kontrola niezależna w nowym kontekście.

**Reprodukcja:** `pnpm test` — 1260 testów, 0 błędów (JUnit); `pnpm typecheck`, `pnpm lint`, `pnpm format:check` — czyste. `pnpm vitest run --project web copyRegister` — 18 passed.

**Kryteria:**
- AC1 — pass. Fixture `components/Modal/Modal.tsx` obejmuje wszystkie pięć atrybutów (w tym `alt={"Logo"}`), jednowyrazowe, bez polskiej litery; komunikat wskazuje plik i tekst. Odtworzenie z „Steps to reproduce” na repo: `<span aria-label="Zamknij" />` dopisane do `components/AddBar/AddBar.tsx` → repo-test czerwony z `components/AddBar/AddBar.tsx · „Zamknij”`.
- AC2 — pass. Ten sam fixture ma `role`, `id`, `className`, `data-testid`, `aria-labelledby`, `type`, `src` z literami (część z wielkiej litery); oczekiwany komunikat jest ciągłym fragmentem, a nietekstowe atrybuty stoją między zgłaszanymi (`data-testid`/`aria-labelledby` przed „Zamknij”, `src` między „Logo” a „Szukaj”), więc ich zgłoszenie rozerwałoby fragment i test byłby czerwony.
- AC3 — pass. Nagłówek `copyRegister.test.ts`, komentarz `sharedTsxTexts` i `web.md` „Pułapki” (+ historia zmian) opisują ten sam zestaw atrybutów co `TEXT_ATTRIBUTES`.
- AC4 — pass. Repo-test zielony; fixture T-100/T-103/T-106 bez zmian i zielone; pełny `pnpm test` zielony.

**Mutacje QA (zmiana → test → `git checkout -- <plik>`, `git status` czysty):**
1. Usunięte `jsxTexts.push(attribute)` w `sharedTsxTexts` → `1 failed` (test T-107, `AssertionError: expected [Function check] to throw an error`).
2. `aria-label="Zamknij"` w `AddBar.tsx` → repo-test czerwony (j.w.).

**Fix task:** „Root cause” wyjaśnia, czemu testy nie złapały (atrybut szedł ścieżką `looksLikeText`, fixture T-106 nie miały atrybutu dostępności); czerwony dowód w Evidence; mutacja 1 potwierdza, że test reprodukujący pada bez poprawki.

**Bezpieczeństwo:** brak `threats:`; zmiana dotyczy tylko testu i dokumentacji.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | Test coverage | Wyrażenie inne niż literał w atrybucie tekstowym (`aria-label={open ? "Zwiń" : "Rozwiń"}`, szablon z `${…}`) idzie ścieżką `looksLikeText`, więc jednowyrazowe gałęzie bez polskiej litery nie są zgłaszane. Zapisane w „Root cause” jako poza zakresem; dziś brak takich przypadków. | `apps/web/test/copyRegister.ts`, `textAttributeValue` | Literały wewnątrz wyrażenia atrybutu tekstowego traktowane jak tekst JSX. |
| 2 | note | Test coverage | Tekstowe propsy własnych komponentów (`label`, `heading`, `description` itp.) nie są w `TEXT_ATTRIBUTES`; `<IconButton label="Zamknij">` w module wspólnym ominąłby rejestr. Dziś brak takich literałów w `.tsx` modułów wspólnych (grep QA). | `apps/web/test/copyRegister.ts:308` | Rozważyć dopisanie propsów tekstowych komponentów design systemu albo regułę „każdy literał z literą w propsie komponentu z wielkiej litery”. |
