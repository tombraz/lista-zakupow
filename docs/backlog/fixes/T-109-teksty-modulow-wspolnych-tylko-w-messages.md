---
id: T-109
title: "Test Copy: teksty modułów wspólnych tylko w `<nazwa>Messages.ts`; każdy wyświetlany literał gdzie indziej to błąd"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: done                  # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: []
threats: []
screens: [SC-01, SC-02, SC-03, SC-04, SC-05, SC-06, SC-07, SC-08, SC-09]
related_tasks: [T-100, T-103, T-106, T-107, T-108]
---

# T-109 Test Copy: teksty modułów wspólnych tylko w `<nazwa>Messages.ts`; każdy wyświetlany literał gdzie indziej to błąd

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-09-1.md`. Dotyczy S1 (major) i K1 (major), a także K2, K3, K4, S3 i S4 (minor). Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:** siła testu zgodności Copy zależy od położenia i nazwy pliku.
  - `messages.ts` i `<nazwa>Messages.ts`: każdy literał (`apps/web/test/copyRegister.ts:39`, `:236-240`).
  - `.tsx` modułu wspólnego: tekst JSX i literał pięciu atrybutów z `TEXT_ATTRIBUTES` są sprawdzane zawsze, a inne literały tylko przez `looksLikeText`, czyli polska litera albo dwa słowa (`:180-183`, `:322-339`).
  - Inny `.ts` modułu wspólnego (`lists/listName.ts`, `errorText.ts`, `session/personName.ts`): tylko `looksLikeText`.

  Jednowyrazowy tekst bez polskich znaków przechodzi więc po cichu: `{ cancel: "Anuluj" }` w `.tsx`, `<span>{"Zamknij"}</span>`, `<MoreMenu label="Zamknij">` oraz `{ cancel: "Anuluj" }` w `lists/leaveList.ts`. Komunikat błędu testu (`copyRegister.ts:59`, „np. lists/listName.ts”) i `docs/architecture/layers/web.md:103` kierują teksty akurat do najsłabiej sprawdzanego `.ts`. Fikstury (`apps/web/src/screens/copyRegister.test.ts:390-422`, `:567-583`) sprawdzają tylko teksty, które heurystyka i tak łapie.
  Powiązane:
  - K3: trzy kształty plików tekstów (`*Messages` jako obiekt; `productMessages.ts` ze stałą i funkcją; teksty wymieszane z hookami w `listName.ts` i `personName.ts`).
  - K2/S3: `documentTitle` powtarza literał nazwy produktu zamiast `PRODUCT_NAME` (`components/productMessages.ts:2`, `:6`), a SC-04 i SC-08 składają tytuł ręcznie w `.tsx` ekranu (`TermsScreen.tsx:17`, `InvitationScreen.tsx:23`).
  - K4: mapa „Gdzie jest kod” w `web.md:22`, `:36` nie wymienia plików `*Messages.ts`.
  - S4: JSDoc `texts()` (`copyRegister.ts:231-235`) jest nieaktualny.
- **Expected:** teksty interfejsu modułu wspólnego (poza `screens/`) są tylko w `<nazwa>Messages.ts`, sprawdzanym w całości. Wyświetlany literał z literą w innym `.ts` lub `.tsx` modułu wspólnego to błąd testu, niezależnie od liczby słów i polskich znaków. Źródło: `web.md:103` (Copy jest pełnym rejestrem tekstów; tekst w `.tsx` modułu wspólnego to błąd testu), decyzja właściciela 2026-11-05 (T-100).
- **Steps to reproduce:**
  1. W fiksturze `findCopyGaps` dodaj `lists/leaveList.ts` z `export const m = { confirm: "Opuść", cancel: "Anuluj", close: "Zamknij" }`, importowany przez ekran, bez wierszy Copy.
  2. Wynik: test zgłasza tylko „Opuść”.
  3. To samo w `.tsx` modułu wspólnego: `const t = { cancel: "Anuluj" }` i `<span>{"Zamknij"}</span>`. Test nie zgłasza nic.
- **Environment:** lokalnie, commit `f0eb4d6`.
- **Evidence:** `docs/reviews/E-02-2026-11-09-1.md`, S1 i K1. Sonda subagenta spójności potwierdziła krok 1.

## Acceptance criteria

- [ ] AC1: Given `.tsx` modułu wspólnego z literałem wyświetlanym w obiekcie (`{ cancel: "Anuluj" }`), wyrażeniu JSX (`{"Zamknij"}`) albo propsie własnego komponentu (`label="Zamknij"`), when uruchamia się test Copy, then test jest czerwony i wskazuje plik i tekst. Atrybuty, które nie są tekstem (`className`, `type`, `role`, `id`, `data-*`, `aria-*by`, `aria-controls`, `href`, `to`, `variant`, `tone`, `autoComplete` itd.), nie dają błędu. — verified by: fikstury w `copyRegister.test.ts` (po jednej dla każdego przypadku i dla atrybutów, które nie są tekstem)
- [ ] AC2: Given `.ts` modułu wspólnego spoza `screens/`, który nie nazywa się `<nazwa>Messages.ts`, z wyświetlanym jednowyrazowym literałem („Anuluj”), when uruchamia się test, then test jest czerwony i każe przenieść tekst do `<nazwa>Messages.ts`. Komunikat błędu (`copyRegister.ts:59`) wskazuje `<nazwa>Messages.ts`, a nie `lists/listName.ts`. — verified by: fikstura z `lists/leaveList.ts` (`Opuść`, `Anuluj`, `Zamknij`)
- [ ] AC3: Given repo po zmianie, then teksty z `lists/listName.ts`, `session/personName.ts` i `errorText.ts` są w `<nazwa>Messages.ts`. `documentTitle` używa `PRODUCT_NAME`. SC-04 i SC-08 tworzą tytuł karty przez `documentTitle`, a Copy `product.documentTitle` w `design-system.md:199` wymienia miejsca użycia. Test Copy repo jest zielony, a wartości tekstów są co do znaku takie jak przed zmianą (albo zmiana ma wiersz Copy zatwierdzony przez właściciela). — verified by: `pnpm vitest run --project web copyRegister`, diff tekstów
- [ ] AC4: Given dokumentacja, then `web.md:103` i nagłówek testu opisują jedną regułę („teksty modułu wspólnego tylko w `<nazwa>Messages.ts`”). Mapa „Gdzie jest kod” (`web.md:22`, `:36`) wymienia pliki `*Messages.ts`, a JSDoc `texts()` jest aktualny. — verified by: przegląd QA
- [ ] AC5: No regression in: T-100, T-103, T-106, T-107, T-108 (fikstury testu Copy), SC-01–SC-09 (teksty bez zmian), `pnpm lint`, `pnpm typecheck`.

## TDD plan

**Seam:** `findCopyGaps` (`apps/web/test/copyRegister.ts`) wywoływane z fikstur w `apps/web/src/screens/copyRegister.test.ts` oraz test repo.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `.tsx` wspólny: obiekt `{ cancel: "Anuluj" }` → błąd | unit | Vitest | AC1 |
| 2 | `.tsx` wspólny: `{"Zamknij"}` i `label="Zamknij"` → błąd | unit | Vitest | AC1 |
| 3 | `.tsx` wspólny: `className="row"`, `type="button"`, `role="dialog"` → brak błędu | unit | Vitest | AC1 |
| 4 | `lists/leaveList.ts` z „Anuluj” → błąd z odesłaniem do `<nazwa>Messages.ts` | unit | Vitest | AC2 |
| 5 | test repo zielony po przeniesieniu tekstów | unit | Vitest | AC3 |

**Run:** `pnpm vitest run --project web copyRegister`

## QA plan

- **Regression:** teksty wszystkich ekranów SC-01–SC-09 (diff wartości), tytuł karty SC-04 i SC-08, komunikaty błędów nazwy listy i imienia.
- **Edge cases:** literał w szablonie z parametrem, literał w tablicy, w `switch`/porównaniu (nie jest tekstem), argument `new Intl…` (nie jest tekstem), stała z pakietu `@lista/shared`, stała z tego samego modułu (`PRODUCT_NAME`).
- **Platforms:** web (test jednostkowy), przegląd tytułu karty w przeglądarce.

## Root cause

T-103 i T-106 zaostrzały kontrolę tylko dla tych przypadków, które dało się pokazać na znalezionym tekście („Opuść”, „Żeby wrócić…”). Dla pozostałych literałów została heurystyka `looksLikeText` z T-100, więc fikstury przechodziły z heurystyką, a nie dzięki regule. Inne miejsca o tym samym wzorcu: każdy `.ts` modułu wspólnego z tekstami obok logiki — pomiar nową regułą na repo: `errorText.ts`, `lists/listName.ts`, `session/personName.ts` (naprawione tutaj); innych nie ma.

Dlaczego testy nie złapały: fikstury T-100–T-107 sprawdzały tylko teksty, które heurystyka `looksLikeText` i tak łapie (polska litera albo dwa słowa), a fikstura „only literals that look like interface text count” wręcz utrwalała tekst w `lists/listName.ts` jako poprawny układ.

## Evidence

Red (przed zmianą `copyRegister.ts`):
- `findCopyGaps (fixtures) > a displayed literal in a shared .tsx file is an error: object value, JSX expression, component prop (T-109)` — `AssertionError: expected [Function check] to throw an error` (AC1).
- `… > a shared .ts module other than <name>Messages.ts with a displayed one-word text is an error (T-109)` — `AssertionError: expected [Function check] to throw an error` (AC2, `lists/leaveList.ts`: „Opuść”, „Anuluj”, „Zamknij”).
- Fikstury T-106 i T-107 (`.tsx` wspólny, atrybuty): czerwone na nowym nagłówku błędu (komunikat wskazuje `<nazwa>Messages.ts`, nie `lists/listName.ts`).

Po zmianie reguły test repo był czerwony z dokładnie tymi tekstami, które wymienia raport: `errorText.ts` (2), `lists/listName.ts` (2), `session/personName.ts` (2). Pośrednie kroki pomiaru odsiały fałszywe trafienia kodu: camelCase (`listId`, `deleteList`, `sessionEnd`) — „słowo z wielkiej litery” liczy się od początku słowa; argument wywołania w JSX (`toLocaleUpperCase("pl-PL")` w `Avatar.tsx`) — liczy się jak literał poza JSX.

Zmiany:
- `apps/web/test/copyRegister.ts`: `misplacedSharedTexts()` zamiast `sharedTsxTexts()` — każdy plik `.ts`/`.tsx` modułu wspólnego (poza `screens/`, bez testów i `.d.ts`) poza `<nazwa>Messages.ts`. W JSX każdy literał z literą poza atrybutami kodu (`CODE_ATTRIBUTES`, `data-*`, `on…`, `aria-*` poza `TEXT_ARIA`) i argumentami wywołań; poza JSX każdy literał, który nie jest kodem (`isCode`). `TEXT_ATTRIBUTES`/`textAttributeValue` usunięte (domyślnie atrybut jest tekstem). Stała tego samego modułu z literałem rozwijana w szablonie (`localConstant`). JSDoc `texts()` i `MESSAGES_FILE` aktualne (S4).
- Teksty przeniesione bez zmiany wartości: `errorTextMessages.ts` (`COMMON_ERROR_TEXTS`, `HIDDEN_CHARACTERS_TEXT`), `lists/listNameMessages.ts` (`listNameErrorText`), `session/personName.ts` → `session/personNameMessages.ts` (`git mv`). Importy: `errorText.ts`, `lists/listName.ts`, `ListNameField.tsx`, SC-02 `messages.ts`, SC-06 `messages.ts`, SC-09 `NameForm.tsx`.
- `components/productMessages.ts`: `documentTitle` z `PRODUCT_NAME` (K2/S3); SC-04 `TermsScreen.tsx` i SC-08 `InvitationScreen.tsx` tworzą tytuł karty przez `documentTitle`; Copy `product.documentTitle` w `design-system.md` wymienia AppBar, AuthPage, SC-04, SC-08.
- Dokumenty: nagłówek `copyRegister.test.ts`, `web.md` „Pułapki” (jedna reguła), „Gdzie jest kod” (pliki `*Messages.ts`, K4), historia zmian.

Diff wartości tekstów (`git diff apps/web/src`, linie z literałami): każdy przeniesiony literał jest co do znaku taki sam; tytuł SC-04/SC-08 daje ten sam ciąg `{tytuł} · Wspólna lista zakupów`.

Mutacje (zmiana, test, przywrócenie), każda złapana:
- bez `localConstant` → fikstura `PRODUCT_NAME` czerwona;
- JSX nie ściśle (tylko `isCode`) → fikstura AC1 czerwona (`„lub”`, `„ok”`; pierwsza wersja fikstury miała tylko słowa z wielkiej litery i mutacja przeżyła — dodane teksty małą literą);
- `label` jako atrybut kodu → fikstura AC1 czerwona;
- argumenty wywołań w JSX liczone ściśle → test repo (`pl-PL`) i fikstura `listNameErrorText("x")` czerwone.

`pnpm vitest run --project web copyRegister` — 23 passed. `pnpm build` exit 0. `pnpm check` (format, lint, typecheck, quality, design-check, backlog-check, test, test:mobile): trzeci przebieg exit 0 (`Test Files 155 passed`, `Tests 1265 passed`). Dwa wcześniejsze przebiegi miały po jednym innym błędzie, oba zielone pojedynczo i niezwiązane z tekstem: `SC-08 … sign up with a taken e-mail → „Zaloguj się” … (T-028)` — `Test timed out in 5000ms` pod obciążeniem (pojedynczo 1,1–2,0 s; zmiana w `InvitationScreen.tsx` to tylko `documentTitle`); `|api| routes-nul.test.ts > never logs a raw database exception for NUL input (SEC1)` — warstwa API, poza tym taskiem (pojedynczo 24 passed). Do zgłoszenia jako niestabilne testy.

Granica reguły (zapisana w nagłówku testu): poza JSX jednowyrazowy tekst małą literą bez polskiej litery albo wielkimi literami (`"lub"`, `"OK"`) wygląda jak kod i nie jest zgłaszany. W JSX jest zgłaszany zawsze.

## Regression

- T-100, T-103, T-106, T-107, T-108: fikstury `copyRegister` zielone (T-106/T-107 z nowym nagłówkiem błędu; fikstury z tekstami w `errorText.ts`, `listName.ts`, `personName.ts`, `leaveList.ts` przeniesione na pliki `*Messages.ts`, bo stary układ jest teraz błędem).
- SC-01–SC-09: teksty bez zmian; testy ekranów zielone w `pnpm check`. Tytuł karty SC-04 i SC-08: ten sam ciąg.

## Prevention

Reguła zapisana w teście i w `web.md` („teksty modułu wspólnego tylko w `<nazwa>Messages.ts`”) zamyka klasę: miejsce tekstu nie decyduje już o sile kontroli. Propozycję zaakceptował właściciel 2026-11-09 (przegląd E-02 runda 4).

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-09)

Verdict: pass

Reproduce: `pnpm vitest run --project web copyRegister` — 23 passed. `pnpm check` (format, lint, typecheck, quality, design-check, backlog-check, test, test:mobile) — exit 0, `Test Files 155 passed`, `Tests 1265 passed`. `git status` clean after the run.

Acceptance criteria:
- AC1 pass — fixture `a displayed literal in a shared .tsx file…` asserts the exact error list (`Anuluj` in an object, `{"Zamknij"}`, `label="Menu"`, `lub`, `ok`); the companion fixture with `className`, `type`, `role`, `id`, `data-*`, `aria-*by`, `aria-controls`, `href`, `to`, `variant`, `tone`, `autoComplete`, `state` gives no gap. QA probe: ternary in `aria-label` and in JSX content, template in `title` and in content, default prop value `label = "Zamknij"` — all reported.
- AC2 pass — fixture `lists/leaveList.ts` reports `Opuść`, `Anuluj`, `Zamknij`; header points to `<nazwa>Messages.ts` (example `lists/leaveMessages.ts`, which exists). QA probe: array literal, template with parameter, `toast("Zapisano")` in a `.ts` — reported; `switch`/`===` codes, `new Intl.NumberFormat("pl-PL")`, `.test.ts`, `.d.ts` — not reported.
- AC3 pass — `errorTextMessages.ts`, `lists/listNameMessages.ts`, `session/personNameMessages.ts` (rename) hold the texts; diff of moved literals is character-identical. `documentTitle` uses `PRODUCT_NAME`; SC-04 `TermsScreen.tsx` and SC-08 `InvitationScreen.tsx` call `documentTitle`; `design-system.md:199` lists AppBar, AuthPage, SC-04, SC-08. Repo test green. Only remaining literal of the product name outside `productMessages.ts` is the legal text in SC-04 `documents.tsx` (screen, out of scope).
- AC4 pass — `web.md:103`, the test header, `MESSAGES_FILE` and `texts()` JSDoc describe one rule; "Gdzie jest kod" lines 22, 32, 36 name the `*Messages.ts` files.
- AC5 pass — all `copyRegister` fixtures of T-100–T-108 green; lint, typecheck and the full suite green.

Spot-checks (each reverted, `git status` clean):
- `misplacedSharedTexts` skips `.ts` files → AC2 fixture red.
- JSX literals checked with `isCode` like non-JSX → AC1 fixture red.

Red evidence in the Evidence section for tests 1, 2, 4; test 3 is a guard (no-error) fixture, test 5 red-then-green on the repo is described.

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | test rule | Outside JSX a one-word lowercase text without a Polish letter, or an all-caps one, is treated as code and not reported: `{ cancel: "anuluj" }`, `{ ok: "OK" }` in `lists/a.ts`; in JSX a lowercase call argument `{f("zamknij")}` is also not reported. Documented as the rule's boundary in the test header and `web.md:103`. | QA probe with `findCopyGaps` (scratch test, removed) | Accept as documented, or require shared `.ts` modules to contain no text-like literal of any case (owner decision). |
| 2 | note | regression | Browser tab title for SC-04 / SC-08 not checked in a browser; `documentTitle(title)` returns the same `{tytuł} · Wspólna lista zakupów` string as the old template, so the title is unchanged by construction. | code read of `productMessages.ts`, `TermsScreen.tsx`, `InvitationScreen.tsx` | — |
| 3 | note | tests | The author reported two flaky tests under load during `pnpm check` (SC-08 T-028 timeout, API `routes-nul.test.ts` SEC1); the QA run of `pnpm check` was green. | Evidence section; QA `pnpm check` exit 0 | Track as flaky-test follow-up. |
