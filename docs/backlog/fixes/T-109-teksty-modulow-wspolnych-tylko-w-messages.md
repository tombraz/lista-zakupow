---
id: T-109
title: "Test Copy: teksty modułów wspólnych tylko w `<nazwa>Messages.ts`; każdy wyświetlany literał gdzie indziej to błąd"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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

T-103 i T-106 zaostrzały kontrolę tylko dla tych przypadków, które dało się pokazać na znalezionym tekście („Opuść”, „Żeby wrócić…”). Dla pozostałych literałów została heurystyka `looksLikeText` z T-100, więc fikstury przechodziły z heurystyką, a nie dzięki regule. Inne miejsca o tym samym wzorcu: każdy `.ts` modułu wspólnego z tekstami obok logiki.

## Evidence

<Reproducing test: red failure message, then passing. Full suite and static checks result.>

## Prevention

Reguła zapisana w teście i w `web.md` („teksty modułu wspólnego tylko w `<nazwa>Messages.ts`”) zamyka klasę: miejsce tekstu nie decyduje już o sile kontroli. Propozycję zaakceptował właściciel 2026-11-09 (przegląd E-02 runda 4).

<!-- QA rounds are appended below by /qa-task -->
