---
id: T-071
title: "SC-03 i SC-01: komunikaty sukcesu ogłaszane czytnikowi ekranu (stały region status)"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: in-qa           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web]
requirements: [F-03, F-04]
threats: []
screens: [SC-01, SC-03]
related_tasks: [T-053, T-054, T-062]
---

# T-071 SC-03 i SC-01: komunikaty sukcesu ogłaszane czytnikowi ekranu (stały region status)

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-02-1.md`, S1 (major).

- **Actual:** `InlineAlert` z `role="status"` montuje się warunkowo, razem z treścią. Region live wstawiony do drzewa już z tekstem zwykle nie jest ogłaszany (NVDA/JAWS + Chrome). Dotyczy to:
  - „wysłaliśmy link” na SC-03 (`apps/web/src/screens/SC-03-reset-hasla/RequestLinkStep.tsx:28-30`); ponowne wysłanie z tym samym adresem nie zmienia treści, więc nic nie jest ogłaszane;
  - „Hasło zmienione…” i „Konto zostało usunięte.” na SC-01 (`apps/web/src/screens/SC-01-logowanie/SignInScreen.tsx:36-41`); fokus idzie od razu na pole „E-mail”.
- **Expected:** komunikat sukcesu jest ogłaszany (`role="status"`), a fokus zostaje tam, gdzie mówi spec. Źródło: WCAG 4.1.3; `docs/design/screens/SC-03-reset-hasla.md:79`; tabela „Build” w `.claude/skills/brd-to-design/references/accessibility.md`.
- **Steps to reproduce:**
  1. Na SC-03 wpisz e-mail i kliknij „Wyślij link” z włączonym czytnikiem ekranu: komunikat nie jest odczytany.
  2. Wyślij ponownie ten sam adres: nadal nic.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy` @ 7c3435f.
- **Evidence:** poprawny wzorzec w tym samym epiku: `apps/web/src/components/OfflineBanner/OfflineBanner.tsx:13-25` (region jest zawsze w drzewie).

## Acceptance criteria

- [x] AC1: Given SC-03 krok 1, when „Wyślij link” kończy się sukcesem (także drugi raz z tym samym adresem), then tekst trafia do regionu `role="status"`, który był w drzewie przed zdarzeniem; fokus zostaje na przycisku. — verified by: test komponentu
- [x] AC2: Given wejście na SC-01 po resecie hasła albo po usunięciu konta, then komunikat jest w regionie `role="status"` obecnym w drzewie przed wpisaniem tekstu (albo jest ogłaszany innym udokumentowanym sposobem, który działa przy fokusie na polu e-mail). — verified by: test komponentu
- [x] AC3: Given `eslint.config.js`, then `no-restricted-syntax` w `apps/web/src` odrzuca `InlineAlert` z `tone="success"` montowany warunkowo (`cond && <InlineAlert tone="success">`, operator `?:`), z komunikatem odsyłającym do `web.md`, „Pułapki”. Wyjątki tylko przez `eslint.config.js`, nie komentarzem. — verified by: `pnpm lint` zielony po poprawce; kontrola ręczna: przywrócony warunkowy alert daje błąd lintu (Evidence), zmiana cofnięta
- [x] AC4: No regression in: błąd logowania na SC-01 (`role="alert"`, fokus na alercie), zaproszenie na SC-01, axe w E2E.

## TDD plan

**Seam:** ekran przez React Testing Library (MSW).

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | Region `role="status"` istnieje przed wysłaniem i dostaje tekst po sukcesie; drugie wysłanie odświeża ogłoszenie | component | Vitest + RTL | AC1 |
| 2 | SC-01 z `EntryState` po resecie / usunięciu konta: region status istniał przed tekstem | component | Vitest + RTL | AC2 |

**Run:** `pnpm vitest run --project web SC-03 SC-01`

## QA plan

- **Regression:** reset hasła (T-053, T-054), usunięcie konta (T-062), logowanie z zaproszeniem.
- **Edge cases:** dwa wysłania z rzędu, zmiana adresu między wysłaniami, 200% tekstu.
- **Platforms:** Chrome + NVDA albo VoiceOver (ręcznie), web 390 × 844.

## Root cause

`InlineAlert` jest regionem live, a ekrany montowały go warunkowo razem z tekstem (`cond && <InlineAlert tone="success">`, `?:`): region wstawiony do drzewa już z treścią zwykle nie jest ogłaszany, a ponowne wysłanie na SC-03 nie zmieniało treści, więc też nie było ogłoszenia. Wzorzec wszedł z T-008 (`JoinedNotice` na SC-06), T-053 (SC-03), T-054 i T-062 (SC-01). Testy nie złapały tego, bo sprawdzały tylko stan DOM po fakcie (`findByRole("status")` z tekstem), a jsdom nie odróżnia regionu wstawionego z treścią od zmiany treści w istniejącym regionie. Nie było helpera, który by to sprawdzał.

Inne wystąpienia: `JoinedNotice` na SC-06 („Dołączyłeś(-aś) do listy…”). Ta sama przyczyna i ta sama warstwa, mała zmiana, więc poprawione w tym zadaniu. Warunkowe `InlineAlert tone="info"` (SC-01 zaproszenie, SC-05 `RemovedNotice`) i ostrzeżenia nie są komunikatami sukcesu po zdarzeniu i zostają poza zakresem: SC-05 i SC-06 ustawiają fokus na nagłówek, a ostrzeżenia limitu dostają fokus.

## Evidence

**Poprawka:** `InlineAlert` z `tone="success"` zawsze renderuje region `role="status"`. Przy pustej treści (`null`, `false`, `""`) region jest pusty i ukryty wizualnie (`.empty` → `visuallyHidden`, bez miejsca w układzie). Tekst podany już przy montowaniu pojawia się po `SUCCESS_ANNOUNCE_DELAY_MS` (100 ms), więc region jest w drzewie dostępności przed treścią. SC-03 krok 1 czyści `sentTo` przy każdym wysłaniu: region jest pusty w czasie wysyłki, a ten sam tekst po sukcesie znowu zostaje ogłoszony. SC-01 ma jeden region sukcesu (`entryNotice`). SC-06 `JoinedNotice` renderuje alert zawsze.

**Helper testowy:** `apps/web/test/announcements.ts`, `statusAnnouncements()` (MutationObserver). Zapisuje tylko zmianę treści regionu `status`, który był już w drzewie, czyli to, co czytnik ekranu ogłosi.

**Red (przed poprawką)**, `pnpm vitest run --project web SC-03 SC-01 SC-08`:
- `SC-03 … announces „sent” from a status region present before sending, again for the same address (T-071)` → `AssertionError: expected [] to deeply equal [ Array(1) ]`
- `SC-01 … after a password reset announces the message from a status region present before it (T-071)` → `AssertionError: expected [] to deeply equal [ Array(1) ]`
- `SC-01 … after an account deletion announces …` → `AssertionError: expected [] to deeply equal [ 'Konto zostało usunięte.' ]`
- `SC-08 … joining opens SC-06 with „Dołączyłeś(-aś)…” …` (dodana asercja) → `AssertionError: expected [] to include 'Dołączyłeś(-aś) do listy „Dom”.'`

**Green:** wszystkie 4 przechodzą. Zmienione stare asercje: `findByRole("status")` zwracało od razu pusty region, więc test najpierw czeka na tekst (`findByText`), a potem sprawdza region (`NewPasswordStep.test.tsx` ×6, `AccountScreen.delete.test.tsx` ×1). E2E `j01-reset-hasla.spec.ts:43`: `toHaveCount(0)` → `toBeEmpty()`, bo region jest stale w drzewie.

**AC3, kontrola ręczna:** w `RequestLinkStep.tsx` chwilowo przywrócono `{form.sentTo !== null && (<InlineAlert tone="success">…)}` oraz `{… ? null : <InlineAlert tone="success">…}`. `eslint` zgłosił `28:46` i `29:51 error InlineAlert tone="success" renderuj zawsze… no-restricted-syntax` (2 errors). Zmianę cofnięto. Reguła jest w `WEB_SUCCESS_ALERT_SYNTAX` w `eslint.config.js`, we wszystkich trzech blokach `apps/web/src`. Nie da się jej wyłączyć komentarzem (przebieg `--no-inline-config`).

**Statyczne i pełne:** `pnpm check` exit 0 (format, lint, typecheck, quality, design-check, backlog-check, workflow-check, 1163 testy + mobile). `pnpm build` OK. E2E całość: 74 passed (5.2 min, telefon + komputer, axe w J-01 reset/nowe hasło/usunięcie konta).

## Prevention

Zaakceptowane przez właściciela 2026-11-02: linia w `web.md`, „Pułapki” (dodana przy przeglądzie) i lint z AC3 (w tym tasku, bo przed poprawką padałby na obecnym kodzie).

## Incident note

<!-- QA rounds are appended below by /qa-task -->
