---
id: T-114
title: "Opis reguł testu Copy i bramek CI po T-110–T-113 w przewodnikach warstw"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: done           # todo | in-progress | in-qa | done | blocked
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
- **Decyzje właściciela 2026-11-10 (/fix):** (1) AC3: `Button.writes` staje się wymagane, zamiast uzasadnienia wartości domyślnej. (2) AC1: T-115 jest jeszcze `todo`, więc T-114 opisuje dopiski tak, jak działają na HEAD; T-115 dostaje AC, że aktualizuje ten opis w `web.md` i nagłówku testu Copy.

## Acceptance criteria

- [x] AC1: Given `web.md:103`, then mówi, że dopisek `pokazuje SC-xx` przechodzi tylko wtedy, gdy kod ekranu SC-xx pokazuje tekst wiersza, a nieistniejący SC-xx to błąd (T-113). Pozostałe dopiski (`mail z API`, `mobile`, `złożony z części`) są opisane tak, jak działają na HEAD: zwalniają wiersz bez sprawdzenia (T-115 zaktualizuje opis, gdy zacznie je sprawdzać). — verified by: odczyt `web.md` wobec `copyRegister.ts`
- [x] AC2: Given `web.md:103` i nagłówek `apps/web/src/screens/copyRegister.test.ts`, then oba opisują granicę kontroli tak, jak działa kod. Poza JSX za kod uchodzi jeden ciąg bez polskiej litery i bez słowa z wielkiej litery (przykład „E-mail”), a `.ts` ekranu spoza `messages.ts` sprawdza `looksLikeText`. Zdanie „niezależnie od liczby słów i polskich znaków” jest zawężone do JSX. — verified by: odczyt wobec `isCode` i `texts()`
- [x] AC3: Given `web.md:77`, then mówi, że `writes` jest wymagane w `Button` i w `MenuAction`; `Button` bez `writes` to błąd `pnpm typecheck`, a każdy istniejący `Button` ma jawne `writes` (decyzja właściciela 2026-11-10). — verified by: `pnpm typecheck` (próbny `Button` bez `writes`) i odczyt `web.md:77`
- [x] AC4: Given historia zmian `web.md`, then ma wiersze T-112 i T-113 (oraz T-114). — verified by: odczyt
- [x] AC5: Given `infra.md`, `pipeline.md` i nagłówek `scripts/test/backlog-check.test.mjs`, then wymieniają kontrole T-110 (`done` z nieodhaczonym AC; status w `UAT.md` zgodny z plikiem zadania). — verified by: odczyt wobec `scripts/backlog-check.mjs`
- [x] AC6: No regression in: `pnpm check` (format, `backlog-check`, test Copy).

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

T-110, T-112 i T-113 zmieniły bramki i reguły (kontrole `backlog-check`, typ `MenuAction`, sprawdzany dopisek `pokazuje SC-xx`), ale tylko w kodzie i nagłówkach testów. Przewodniki warstw i `pipeline.md` zostały przy opisie sprzed zmian. Opis granicy `isCode` od T-109 był za szeroki: „niezależnie od liczby słów i polskich znaków” dotyczy tylko JSX. `Button.writes` miało wartość domyślną `false`, więc nowy przycisk zapisu bez flagi kompilował się i był aktywny bez połączenia. Testy tego nie łapią, bo żaden test nie porównuje dokumentacji z kodem (`web.md`, „Pułapki”, T-081: „Nic nie sprawdza tej zgodności automatycznie”), a luka w typie dotyczy przycisku, którego jeszcze nie ma, więc wymusić ją może tylko typ.

Inne wystąpienia: brak innych opcjonalnych flag `writes`. Przyciski wysyłające żądania bez `writes` (logowanie, rejestracja, oba kroki resetu, SC-08 „Dołącz”, SC-09 „Wyloguj”) dostały jawne `writes={false}`, bez zmiany zachowania. Rozstrzygnięte 2026-11-10 (właściciel przyjął rekomendację): zostają aktywne bez połączenia zgodnie ze specyfikacjami — `SC-09-konto.md` stan Offline („„Wyloguj się” działa”), SC-01, SC-02, SC-03 i SC-08 mają stan „Error — sieć” zamiast blokady; F-15 (nie udawać zapisu) spełnione. Opis w `web.md`, „Konwencje”; bez nowego zadania.

## Evidence

- **Red (AC3):** próbny `apps/web/src/components/Button/probe-T114.tsx` z `<Button>x</Button>`; `pnpm --filter @lista/web typecheck` kończy się kodem 0 (przycisk bez `writes` przechodzi).
- **Green:** po `writes?: boolean` → `writes: boolean` (i bez domyślnego `writes = false`) ta sama próbka daje `error TS2741: Property 'writes' is missing in type '{ children: string; }' but required in type 'ButtonProps'.`; tak samo 21 miejsc w kodzie i testach bez flagi. Każde dostało `writes={false}` (dotąd domyślne), próbka usunięta, typecheck 0 błędów.
- **Dokumenty:** `web.md` („Konwencje” `writes`; „Pułapki” — dopiski Copy, granica `isCode` / `looksLikeText`; „Gdzie jest kod” Button i MoreMenu; historia T-112, T-113, T-114), nagłówek `apps/web/src/screens/copyRegister.test.ts`, `infra.md` („Gdzie jest kod”, „Komendy”, historia), `pipeline.md:55`, nagłówek `scripts/test/backlog-check.test.mjs`. Przykłady granicy sprawdzone na `isCode` / `looksLikeText`: „E-mail”, „albo”, „OK”, „{…} osoby” → kod; „Anuluj”, „do kupienia” → tekst.
- **T-115:** dodane AC7 — aktualizuje opis dopisków w `web.md` i nagłówku testu Copy.
- **Regresja:** `pnpm check` kod 0 (Test Files 155 passed, Tests 1273 passed; `backlog-check` OK — wcześniej złapał `UAT.md` z T-114 `todo`, poprawione); `pnpm --filter @lista/web build` OK.

## Prevention

Propozycja z przeglądu 2026-11-10: QA zadania, które zmienia regułę testu albo bramki CI, sprawdza, że `web.md`, `infra.md` i `pipeline.md` opisują tę regułę po zmianie. Do decyzji właściciela.

Decyzja właściciela 2026-11-10 (/fix): przyjęte. `.claude/agents/task-qa.md`, sekcja „Project checks”: QA zadania, które zmienia regułę testu albo bramki CI (albo zaostrza typ / props komponentu), porównuje nowe zachowanie z opisem w przewodnikach warstw, `pipeline.md` i nagłówku testu; rozjazd albo brak wiersza historii to minor. Automatyczna kontrola zgodności dokumentów z kodem odrzucona jako nieproporcjonalna.

<!-- QA rounds are appended below by /qa-task -->

## QA round 1 (2026-11-10)

Verdict: pass

Sprawdzone samodzielnie: `pnpm check` kod 0 (Test Files 155 passed, Tests 1273 passed; mobile 10 passed; format, lint, typecheck, quality, design-check, backlog-check, workflow-check zielone). Próbny `apps/web/src/components/Button/qaProbe.tsx` z `<Button>x</Button>` → `pnpm --filter @lista/web typecheck`: `error TS2741: Property 'writes' is missing in type '{ children: string; }' but required in type 'ButtonProps'`; po usunięciu próbki typecheck 0, `git status` czysty. `tsconfig` web obejmuje `src`, `test`, `e2e`, więc każdy istniejący `Button` (także w testach) ma jawne `writes`.

| AC | Wynik | Dowód |
| --- | --- | --- |
| AC1 | pass | `web.md` „Pułapki”: `pokazuje SC-xx` sprawdzany wobec tekstów ekranu SC-xx, nieistniejący SC-xx to błąd; zgodne z `SHOWN_ON` i `findUnusedCopyRows` (`copyRegister.ts:59`, `:144-150`). `mail z API`, `mobile`, `złożony z części` zwalniają wiersz bez sprawdzenia — zgodne z `COPY_SOURCE.test(note)` → `continue` (`:144`). |
| AC2 | pass | `web.md` i nagłówek `copyRegister.test.ts`: „niezależnie od liczby słów i polskich znaków” tylko w JSX; granica `isCode` i `looksLikeText` opisane. Przykłady sprawdzone na regexach z `copyRegister.ts:480-492`: „E-mail”, „albo”, „OK”, „{…} osoby” → `isCode=true`; „Anuluj”, „do kupienia” → tekst; „Anuluj” w `.ts` ekranu → `looksLikeText=false` (przechodzi bez wiersza), zgodnie z opisem `texts()` (`:327-330`). |
| AC3 | pass | `Button.tsx`: `writes: boolean`, bez domyślnego; próbka bez `writes` daje TS2741 (wyżej); `web.md` „Konwencje” mówi o wymaganym `writes` w `Button` i `MenuAction`. Zmiany `writes={false}` tylko tam, gdzie było domyślne `false` — bez zmiany zachowania. |
| AC4 | pass | Historia `web.md` ma wiersze T-114, T-113, T-112. |
| AC5 | pass | `infra.md` („Gdzie jest kod”, „Komendy”, historia), `pipeline.md:55`, nagłówek `scripts/test/backlog-check.test.mjs`: AC zadań `done` i statusy w `UAT.md` jako błędy (T-110), przekazania jako ostrzeżenie (T-099) — zgodne z `scripts/backlog-check.mjs` (`errors.push` dla T-110, `warnings.push` dla przekazań). |
| AC6 | pass | `pnpm check` kod 0. |

| # | Severity | Area | Finding | Evidence | Expected |
| --- | --- | --- | --- | --- | --- |
| 1 | minor | docs | Nowe sformułowanie reguły `isCode` „bez wielkiej litery, po której stoi mała” jest dosłownie sprzeczne z przykładem `"listId"` w tym samym zdaniu (w `listId` po „I” stoi „d”, a test uznaje to za kod). Kod sprawdza wielką literę na początku słowa, po której stoi mała: `/(^|\P{L})\p{Lu}\p{Ll}/u`. | nagłówek `apps/web/src/screens/copyRegister.test.ts` (lista przykładów z `"listId"`), `web.md` „Pułapki”; `copyRegister.ts:480-486` | „bez słowa, które zaczyna się wielką literą, po której stoi mała” (jak komentarz `isCode`). |
| 2 | note | product / F-15 | `writes={false}` dostały też przyciski wysyłające żądania: „Dołącz” (SC-08), „Wyloguj” (SC-09), wysłanie logowania, rejestracji i resetu hasła. Zachowanie bez zmian, decyzja F-15 nadal otwarta (opisana w „Root cause”). | `InvitationScreen.tsx:101`, `AccountScreen.tsx:45` | Rozstrzygnięcie właściciela, czy mają być nieaktywne bez połączenia. |
| 3 | note | TDD | Dowód red dla AC3 (próbka typecheck kod 0 przed zmianą) jest w Evidence; reszta to dokumentacja sprawdzana odczytem, zgodnie z planem. | Evidence | — |

Spot-check: próbka bez `writes` łamie typecheck (test „gryzie”), usunięta; `git status` czysty przed zapisem raportu.

**Po QA round 1 (minor #1):** opis `isCode` w `web.md:103` i nagłówku `copyRegister.test.ts` poprawiony na „bez słowa, które zaczyna się wielką literą, po której stoi mała” (zgodnie z `(^|\P{L})\p{Lu}\p{Ll}`; `listId` to kod). Prettier i `backlog-check` OK.
