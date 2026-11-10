---
id: T-114
title: "Opis reguł testu Copy i bramek CI po T-110–T-113 w przewodnikach warstw"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web, infra]
requirements: []
threats: []
screens: []
related_tasks: [T-104, T-109, T-110, T-112, T-113]
---

# T-114 Opis reguł testu Copy i bramek CI po T-110–T-113 w przewodnikach warstw

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-10-1.md`, ustalenia S3/P1, S5, K4 i granica S1. Właściciel zatwierdził zadanie 2026-11-10. Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:**
  - `docs/architecture/layers/web.md:103` podaje `pokazuje SC-xx` jako zwykły dopisek źródła, na równi z `mail z API`. Od T-113 test sprawdza, że SC-xx pokazuje tekst, a nieistniejący SC-xx to błąd.
  - Historia zmian `web.md` kończy się na T-111 i nie ma wpisów T-112 ani T-113.
  - `web.md:103` obiecuje kontrolę literałów „niezależnie od liczby słów i polskich znaków”. Poza JSX `isCode` (`apps/web/test/copyRegister.ts:480-486`) przepuszcza jednak jeden ciąg bez polskiej litery i bez wielkiej litery, po której stoi mała, np. „E-mail”, „albo”, `` `${n} osoby` ``. Nagłówek testu i `web.md:103` nie mówią też, że `.ts` ekranu spoza `messages.ts` jest sprawdzany tylko przez `looksLikeText` (S2, K3).
  - `web.md:77` wymaga `writes` na przycisku i pozycji menu. Od T-112 `MenuAction.writes` jest wymagane, a `Button.writes` zostaje opcjonalne z domyślnym `false` (`apps/web/src/components/Button/Button.tsx:19`, `:24`), bez uzasadnienia.
  - `docs/architecture/layers/infra.md:37`, `docs/architecture/pipeline.md:55` i nagłówek `scripts/test/backlog-check.test.mjs:1-3` opisują `backlog-check` tylko jako kontrolę przekazań (T-099). Brakuje kontroli z T-110: zadanie `done` z nieodhaczonym AC i status w `UAT.md` niezgodny z plikiem zadania.
- **Expected:** przewodniki warstw opisują zachowanie testu Copy i bramek CI takie, jakie jest na HEAD. Źródło: `web.md`, „Pułapki” (T-081): task, który zmienia opisany mechanizm, aktualizuje opis w tym samym tasku.
- **Steps to reproduce:** przeczytać `web.md:103`, `:77`, `:116-120`, `infra.md:37`, `pipeline.md:55` i porównać z `apps/web/test/copyRegister.ts` (`SHOWN_ON`, `isCode`, `texts()`) oraz `scripts/backlog-check.mjs:244-253`.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy`, HEAD `3de5af5`.
- **Evidence:** przegląd E-02 2026-11-10, S3, S5, K4, S1.

## Acceptance criteria

- [ ] AC1: Given `web.md:103`, then mówi, że dopisek `pokazuje SC-xx` przechodzi tylko wtedy, gdy kod ekranu SC-xx pokazuje tekst wiersza, a nieistniejący SC-xx to błąd (T-113). Pozostałe dopiski są opisane tak, jak działają po T-115. — verified by: odczyt `web.md` wobec `copyRegister.ts`
- [ ] AC2: Given `web.md:103` i nagłówek `apps/web/src/screens/copyRegister.test.ts`, then oba opisują granicę kontroli tak, jak działa kod. Poza JSX za kod uchodzi jeden ciąg bez polskiej litery i bez słowa z wielkiej litery (przykład „E-mail”), a `.ts` ekranu spoza `messages.ts` sprawdza `looksLikeText`. Zdanie „niezależnie od liczby słów i polskich znaków” jest zawężone do JSX. — verified by: odczyt wobec `isCode` i `texts()`
- [ ] AC3: Given `web.md:77`, then mówi, dlaczego `Button.writes` jest opcjonalne, a `MenuAction.writes` wymagane. Jeśli właściciel zdecyduje inaczej, `Button.writes` staje się wymagane w tym zadaniu. — verified by: odczyt albo `pnpm typecheck`
- [ ] AC4: Given historia zmian `web.md`, then ma wiersze T-112 i T-113 (oraz T-114). — verified by: odczyt
- [ ] AC5: Given `infra.md`, `pipeline.md` i nagłówek `scripts/test/backlog-check.test.mjs`, then wymieniają kontrole T-110 (`done` z nieodhaczonym AC; status w `UAT.md` zgodny z plikiem zadania). — verified by: odczyt wobec `scripts/backlog-check.mjs`
- [ ] AC6: No regression in: `pnpm check` (format, `backlog-check`, test Copy).

## TDD plan

**Seam:** zmiana dokumentacji, bez zmiany zachowania. Testem jest `pnpm check`, a QA porównuje opis z kodem. Jeśli w AC3 właściciel wybierze wymagane `Button.writes`, testem jest `pnpm typecheck`: każdy `Button` bez `writes` daje błąd kompilacji.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `pnpm check` zielony po zmianie dokumentów | static | pnpm | AC6 |

**Run:** `pnpm check`

## QA plan

- **Regression:** `pnpm check`.
- **Edge cases:** każde zdanie o regule porównać z kodem (`SHOWN_ON`, `COPY_SOURCE`, `isCode`, `looksLikeText`, `MESSAGES_FILE`).
- **Platforms:** dokumentacja.

## Root cause

<Wypełnia /fix.>

## Evidence

<Wypełnia /fix.>

## Prevention

Propozycja z przeglądu 2026-11-10: QA zadania, które zmienia regułę testu albo bramki CI, sprawdza, że `web.md`, `infra.md` i `pipeline.md` opisują tę regułę po zmianie. Do decyzji właściciela.

<!-- QA rounds are appended below by /qa-task -->
