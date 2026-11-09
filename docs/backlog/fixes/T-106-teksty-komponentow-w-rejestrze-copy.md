---
id: T-106
title: "Teksty komponentów design systemu (`components/*.tsx`) w plikach komunikatów i w rejestrze Copy"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done            # todo | in-progress | in-qa | done | blocked
depends_on: [T-103]
layers: [web]
requirements: []
threats: []
screens: [SC-01, SC-02, SC-03, SC-04, SC-05, SC-06, SC-07, SC-08, SC-09]
related_tasks: [T-100, T-103]
---

# T-106 Teksty komponentów design systemu (`components/*.tsx`) w plikach komunikatów i w rejestrze Copy

## Report

Źródło: T-103 (decyzja właściciela 2026-11-06: osobny task). Gałąź: `epic/E-02-konto-i-uczestnicy` albo `fix/T-106-…` z `main` po scaleniu epiku (`git-workflow.md`, „Fixes”).

- **Actual:** kontrola T-103 (tekst interfejsu w `.tsx` modułu wspólnego = błąd testu Copy) pomija `components/`, bo teksty komponentów nie mają tabeli Copy: `design-system.md` opisuje je w tekście, a test zgodności nie czyta `design-system.md`. Po włączeniu `components/` test zgłasza (stan z commitu T-103):
  - `components/AppBar/AppBar.tsx` · „{…} · Wspólna lista zakupów”
  - `components/AuthPage/AuthPage.tsx` · „{…} · Wspólna lista zakupów”, „Wspólna lista zakupów”, „Regulamin i polityka prywatności”
  - `components/LoadError/LoadError.tsx` · „Spróbuj ponownie”
  - `components/OfflineBanner/OfflineBanner.tsx` · „Brak połączenia. Zmiany nie są zapisywane.”, „Połączenie przywrócone.”
  - `components/PasswordField/PasswordField.tsx` · „Pokaż”
- **Expected:** teksty w plikach komunikatów (`web.md`, „Konwencje”), z wierszem Copy ekranu albo komponentu w `design-system.md` (`web.md`, „Pułapki”, Copy jako rejestr), sprawdzane testem bez listy wyjątków.
- **Steps to reproduce:** w `apps/web/test/copyRegister.ts` (`sharedTsxTexts`) usunąć warunek `!file.startsWith("components/")` i uruchomić `pnpm vitest run --project web copyRegister`.
- **Environment:** lokalnie, gałąź `epic/E-02-konto-i-uczestnicy` po T-103.

## Acceptance criteria

- [x] AC1: Given komponenty z listy, then ich teksty są w plikach `.ts` (`<nazwa>Messages.ts` albo `messages.ts` komponentu), a `.tsx` je importują. — verified by: test zgodności Copy (kontrola `.tsx` obejmuje `components/`)
- [x] AC2: Given `design-system.md`, then ma tabelę Copy komponentów (albo ekrany mają wiersze), a test zgodności ją czyta; braki rozstrzyga właściciel (`web.md`: nie wymyślać tekstów). — verified by: `copyRegister.test.ts`
- [x] AC3: Given plik `.tsx` modułu wspólnego (także `components/` po AC1) z tekstem JSX, który ma literę, ale nie wygląda na polski tekst (np. `<span>Zamknij</span>`), when uruchamia się test zgodności Copy, then test jest czerwony ze wskazaniem pliku. Test ma fixture tego przypadku, a zakres w nagłówku testu i w `web.md` jest z nim zgodny. Źródło: uwaga minor QA T-103, runda 1 (zaakceptowana przez właściciela 2026-11-06). — verified by: test jednostkowy `copyRegister` z fixture
- [x] AC4: No regression in: testy komponentów `components/`, E2E bez zmian.

## Root cause

Kontrola T-103 (`sharedTsxTexts()` w `apps/web/test/copyRegister.ts`) świadomie pomijała `components/`, bo komponenty design systemu nie miały tabeli Copy: `design-system.md` opisywał ich teksty w prozie („Budowa”, „Stany”), a test zgodności czytał tylko `docs/design/screens/`. Teksty w `.tsx` komponentów nie trafiały więc ani do rejestru, ani do błędu „tekst w `.tsx`”. Drugi otwór: w `.tsx` liczył się tylko tekst JSX, który `looksLikeText` uznaje za polski tekst, więc `<span>Zamknij</span>` przechodził (uwaga QA T-103).

Dlaczego testy nie złapały: zakres T-103 wykluczał `components/` decyzją właściciela, a fixture nie miały przypadku jednowyrazowego tekstu JSX bez polskiej litery.

Inne wystąpienia: po włączeniu `components/` i zaostrzeniu reguły JSX test znalazł dokładnie 8 tekstów z raportu; innych tekstów JSX z literą w `components/` ani w innych modułach wspólnych nie ma. „Ukryj” (`PasswordField`, literał bez polskiej litery w wyrażeniu warunkowym) nie był zgłaszany, ale przeniesiony razem z „Pokaż”.

Zmiany:
- `components/productMessages.ts` (`PRODUCT_NAME`, `documentTitle()` — AppBar, AuthPage), `AuthPage/authPageMessages.ts`, `LoadError/loadErrorMessages.ts`, `OfflineBanner/offlineBannerMessages.ts`, `PasswordField/passwordFieldMessages.ts`; `.tsx` tylko importują (AC1). `productMessages` ma dwa eksporty, żeby AppBar nie wymagał na ekranach nazwy produktu, której nie pokazuje (test liczy importowany symbol).
- `design-system.md`: nowa sekcja „## Copy” komponentów (7 wierszy); „Stany” PasswordField: „Pokaż” / „Ukryj” (AC2).
- `test/copyRegister.ts`: wejście `designSystem`; tekst z pliku w `components/` pasuje do Copy ekranu albo Copy komponentów, inny tylko do Copy ekranu; brak sekcji „## Copy” w `design-system.md` to błąd. `sharedTsxTexts()` obejmuje `components/`, a każdy tekst JSX z literą to błąd (AC3). Literały w `.tsx` dalej przez `looksLikeText` (klasy, typy).
- Nagłówek `copyRegister.test.ts` i `web.md` („Pułapki”, historia zmian) opisują nowy zakres.

## Evidence

Właściciel 2026-11-06: `product.documentTitle` „{tytuł} · Wspólna lista zakupów” zatwierdzony bez zmiany; PasswordField „Pokaż” / „Ukryj” (jak w kodzie, opis „Stany” poprawiony); pozostałe wiersze z zatwierdzonych dokumentów (Layout SC-01, Copy SC-01 `legal`, Layout/States SC-05–SC-07, OfflineBanner w `design-system.md`, T-080) w nowej sekcji „## Copy” `design-system.md`.

Red:
- `findCopyGaps (fixtures) > interface text in a shared .tsx file (outside screens/, also components/) is an error naming the file` — `AssertionError: expected [Function withTexts] to throw error including 'Teksty interfejsu …'` (brak `components/Banner.tsx · „Jesteś offline”` i `components/Close.tsx · „Zamknij”`).
- `texts of a design system component match the component Copy in design-system.md or the screen Copy` — `AssertionError: expected [ { screen: 'SC-01', …(2) }, …(3) ] to deeply equal [ { screen: 'SC-01', …(2) } ]`.
- Repo po zmianie kontroli: błąd „Teksty interfejsu w plikach .tsx modułów wspólnych …” z 8 tekstami z raportu; po przeniesieniu do `*Messages.ts` — 31 braków Copy (SC-01–SC-03, SC-05–SC-07, SC-09), po dodaniu Copy komponentów — 0.

Green: `pnpm vitest run --project web copyRegister` — 17 passed.

Mutacje ręczne (zmiana, test, przywrócenie): „Ukryj”→„Schowaj”, „Połączenie przywrócone.”→bez kropki, „ · Wspólna”→„ - Wspólna”, „Spróbuj ponownie”→„Spróbuj jeszcze raz” — każda: `Tests 1 failed | 16 passed (17)`.

Pełne sprawdzenie: `pnpm check` exit 0 (format, lint, typecheck, quality, design-check, backlog-check, workflow-check; `Test Files 155 passed`, `Tests 1259 passed`; test:mobile), `pnpm build` exit 0. Teksty na ekranach bez zmian (te same wartości), więc testy komponentów i E2E bez zmian.

## Regression

- Testy komponentów i ekranów używających AppBar, AuthPage, LoadError, OfflineBanner, PasswordField (SC-01–SC-03, SC-05–SC-07, SC-09) — zielone w `pnpm check`.
- T-100, T-103 (test zgodności Copy) — wszystkie fixture zielone.

## Prevention

Domknięcie zakresu kontroli z T-103 (`components/`) oraz uwagi QA T-103: w `.tsx` modułu wspólnego każdy tekst JSX z literą to błąd, nie tylko ten, który `looksLikeText` uznaje za tekst (AC3).

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-06)

Verdict: pass

Zakres: commity `36b45a3`, `d923513` (`d7fe6ba` — status). Kontrola niezależna w nowym kontekście.

**Reprodukcja:** `pnpm install --frozen-lockfile`, `pnpm check` — exit 0 (format, lint, typecheck, quality, design-check, backlog-check, workflow-check; `Test Files 155 passed`, `Tests 1259 passed`; test:mobile). `pnpm vitest run --project web copyRegister` — 17 passed.

**Kryteria:**
- AC1 — pass. `AppBar`, `AuthPage`, `LoadError`, `OfflineBanner`, `PasswordField` importują teksty z `productMessages.ts` / `<nazwa>Messages.ts`; wartości w diffie identyczne co do znaku z dawnymi literałami. Repo-test obejmuje `components/` i jest zielony.
- AC2 — pass. `design-system.md` ma sekcję „## Copy” (7 wierszy); test czyta ją tylko dla plików z `components/`; brak sekcji = błąd (fixture). Wiersze mają źródło w zatwierdzonych dokumentach (SC-01 Layout/Copy `legal`, SC-05–SC-07 States, OfflineBanner „Budowa”/T-080) albo zapis zatwierdzenia właściciela 2026-11-06.
- AC3 — pass. Fixture `components/Close.tsx` z `<span>Zamknij</span>`; nagłówek testu i `web.md` („Pułapki”) opisują ten zakres.
- AC4 — pass dla testów komponentów i ekranów (pełny `pnpm check`). E2E nie uruchamiane przez QA: zmiana nie zmienia renderowanych wartości (diff), więc ryzyko regresji E2E pomijalne.

**Mutacje QA (zmiana → test → przywrócenie z kopii, `git status` czysty):**
1. Tekst JSX znów przez `looksLikeText` → `1 failed` (fixture AC3).
2. Ponowne wykluczenie `components/` w `sharedTsxTexts` → `1 failed`.
3. Copy komponentów dopasowywane też dla plików ekranów → `1 failed` („a screen text never matches the component Copy”).
4. `<span>Pokaz</span>` w `PasswordField.tsx` → repo-test czerwony: `components/PasswordField/PasswordField.tsx · „Pokaz”`.
5. `LoadError.retry` w `design-system.md` → „Spróbuj jeszcze raz” → repo-test czerwony dla SC-05, SC-06, SC-07.

**Fix task:** „Root cause” wyjaśnia, czemu testy nie złapały (zakres T-103 wykluczał `components/`, brak fixture jednowyrazowego JSX); czerwone dowody są w Evidence; mutacje 1–2 potwierdzają, że test reprodukujący pada bez poprawki.

**Bezpieczeństwo:** brak `threats:`; zmiana dotyczy tylko tekstów i testu, bez danych użytkownika.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | Code (duplicated knowledge) | „Wspólna lista zakupów” zapisane dwa razy w `components/productMessages.ts` (`PRODUCT_NAME` i szablon `documentTitle`). Powód: test nie rozwija stałej z importu względnego w szablonie (`${PRODUCT_NAME}` dałby `{…} · {…}`). | `apps/web/src/components/productMessages.ts`, linie 2 i 6 | Jedno źródło nazwy produktu; ewentualnie test rozwijający stałe lokalne/względne w szablonach. |
| 2 | minor | Test coverage | Literał w atrybucie JSX w `.tsx` modułu wspólnego (`aria-label="Zamknij"`) nadal przechodzi przez `looksLikeText`, więc jednowyrazowy tekst bez polskiej litery nie jest zgłaszany. Obecnie w `components/` brak takich atrybutów (grep). | `apps/web/test/copyRegister.ts`, `sharedTsxTexts` | Atrybuty dostępności (`aria-label`, `title`, `alt`, `placeholder`) traktowane jak tekst JSX (każda litera). |
| 3 | note | Design docs | `design-system.md` „## Copy” mówi, że ekran nie powtarza wierszy komponentów, a Copy SC-01 dalej ma `legal` (teraz nieużywany przez kod SC-01; tekst idzie z `AuthPage.legal`). Test nie wykrywa osieroconych wierszy. | `docs/design/screens/SC-01-logowanie.md:75` | Usunąć wiersz albo oznaczyć jako pochodzący z komponentu. |
