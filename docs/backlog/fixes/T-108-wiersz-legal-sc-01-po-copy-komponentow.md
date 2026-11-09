---
id: T-108
title: "Wiersz Copy SC-01 `legal` po przeniesieniu tekstu do Copy komponentów; wykrywanie wierszy Copy bez kodu"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa          # todo | in-progress | in-qa | done | blocked
depends_on: [T-106]
layers: [web]
requirements: []
threats: []
screens: [SC-01]
related_tasks: [T-100, T-106]
---

# T-108 Wiersz Copy SC-01 `legal` po przeniesieniu tekstu do Copy komponentów; wykrywanie wierszy Copy bez kodu

## Report

Źródło: QA T-106, runda 1, notatka #3 (właściciel 2026-11-06: osobny task). Gałąź: `epic/E-02-konto-i-uczestnicy` albo `fix/T-108-…` z `main` po scaleniu epiku (`git-workflow.md`, „Fixes”).

- **Actual:** po T-106 tekst „Regulamin i polityka prywatności” na SC-01 pochodzi z komponentu (`components/AuthPage/authPageMessages.ts`, Copy komponentów `AuthPage.legal` w `design-system.md`). Wiersz `legal` w Copy SC-01 (`docs/design/screens/SC-01-logowanie.md:75`) nie odpowiada już żadnemu tekstowi kodu SC-01, a nowa sekcja „## Copy” w `design-system.md` mówi, że ekran nie powtarza wierszy komponentów. Test zgodności sprawdza tylko kierunek kod → Copy, więc wiersze Copy bez kodu nie są wykrywane. (SC-09 `legal` jest używany: `screens/SC-09-konto/messages.ts:15`.)
- **Expected:** Copy SC-01 nie dubluje wiersza komponentu: wiersz `legal` usunięty albo oznaczony jako tekst komponentu (np. dopisek „(z Copy komponentów `AuthPage.legal`, T-108)”) — decyzja właściciela. Ocenić, czy test ma wykrywać wiersze Copy, których nie używa żaden kod.
- **Steps to reproduce:** usunąć wiersz `legal` z Copy SC-01 i uruchomić `pnpm vitest run --project web copyRegister`: test przechodzi, czyli wiersz jest zbędny dla kodu.
- **Environment:** lokalnie, gałąź `epic/E-02-konto-i-uczestnicy` po T-106 (`f82e372`).

## Acceptance criteria

- [ ] AC1: Given Copy SC-01, then wiersz `legal` jest usunięty albo oznaczony jako tekst komponentu, zgodnie z decyzją właściciela; reguła z sekcji „## Copy” w `design-system.md` jest z tym spójna. — verified by: przegląd QA
- [ ] AC2: Given wiersz Copy ekranu, którego tekstu nie używa żaden kod web tego ekranu, when uruchamia się test zgodności, then test to zgłasza — albo, jeśli właściciel uzna to za zbyt szerokie (Copy zawiera też teksty spoza kodu web: tematy maili, stany z Layout/States, mobile E-04), decyzja i powód są zapisane w tasku, a kontrola zostaje poza zakresem. Jeśli kontrola wymaga więcej niż jednej sesji, przenieść ją do `/plan-backlog`. — verified by: test jednostkowy `copyRegister` z fixture albo zapis decyzji
- [ ] AC3: No regression in: test zgodności Copy na repo (zielony), T-100, T-106.

## Decisions

Właściciel 2026-11-09:
- AC1: usunąć z Copy SC-01 oba wiersze, które powtarzają Copy komponentów: `legal` (= `AuthPage.legal`) i `password.show / hide` (= `PasswordField.show / PasswordField.hide`; drugi dubel znaleziony przy tym tasku).
- AC2: test zgłasza tylko dubel komponentu, czyli wiersz Copy ekranu z tekstem, który ekran bierze wyłącznie z `components/`. Pełnej odwrotnej kontroli (wiersz Copy bez kodu web) test nie robi. Powód: pomiar na repo daje 9 takich wierszy w SC-02, SC-03 i SC-06–SC-09 (lista w „Other occurrences”), każdy wymaga osobnego rozstrzygnięcia (tekst spoza web: mail, API, mobile, albo błąd kodu), więc to więcej niż jedna sesja. Proponowany nowy task przez `/plan-backlog`.

## Root cause

T-106 przeniósł teksty komponentów do tabeli „## Copy” w `design-system.md` i zapisał regułę, że ekran nie powtarza tych wierszy, ale nie usunął wierszy, które SC-01 miał już wcześniej (`legal`, `password.show / hide`). Test zgodności sprawdza tylko kierunek kod → Copy: tekst z `components/` pasuje do Copy ekranu **albo** komponentów, więc dubel zawsze przechodzi.

Dlaczego testy nie złapały: reguła „ekran nie powtarza wierszy komponentów” była tylko w prozie `design-system.md`. Test nie miał kontroli ani fixture dubla. Uwaga z raportu: odwrotna kontrola („wiersz bez kodu”) też by go nie złapała, bo kod SC-01 używa „Regulamin i polityka prywatności” przez `AuthPage` → `authPageMessages`.

Zmiany:
- `apps/web/test/copyRegister.ts` (`findCopyGaps`): wiersz Copy ekranu z tekstem, który ekran bierze z `components/`, ma w Copy komponentów i nie ma w żadnym własnym pliku (spoza `components/`), to błąd ze wskazaniem ekranu, pliku i tekstu. SC-06 `dup.show` „Pokaż” (własny `messages.ts`) i SC-09 `legal` (własny `messages.ts`) nie są dublami.
- `docs/design/screens/SC-01-logowanie.md`: usunięte wiersze `password.show / hide` i `legal` (AC1).
- `docs/design/design-system.md` „## Copy”: zdanie o regule uzupełnione o kontrolę testu (T-108).
- Nagłówek `copyRegister.test.ts` i `web.md` („Pułapki”, historia zmian).

## Other occurrences

Dublet komponentu: tylko SC-01 (`legal`, `password.show / hide`). Test na repo przed usunięciem wierszy zgłosił dokładnie te trzy teksty.

Wiersze Copy, których nie używa żaden kod web ekranu (pomiar jednorazowym skryptem 2026-11-09, poza zakresem decyzją właściciela, proponowany nowy task):
- SC-02: „Akceptuję regulamin i politykę prywatności.”, „Masz już konto? Zaloguj się”, „Konto z tym adresem już istnieje. Zaloguj się albo zresetuj hasło.”
- SC-03: `mail.subject` „Reset hasła — Wspólna lista zakupów” i treść maila (tekst API, nie web)
- SC-06: „Usunąć listę „{…}”? Zniknie też u {…} uczestników.”
- SC-07: „Usunąć {…} z listy? Straci do niej dostęp od razu. Dodane przez niego pozycje zostaną.”, „Opuścić listę „{…}”? Żeby wrócić, potrzebujesz nowego zaproszenia.”
- SC-08: „Dołączyłeś(-aś) do listy „{…}”.”
- SC-09: „Konto zostało usunięte.” (pokazywane na SC-01 jako `info.accountDeleted`)

## Evidence

Red: `findCopyGaps (fixtures) > a screen Copy row that repeats the component Copy for a text the screen takes only from components/ is an error (T-108)` — `AssertionError: expected [Function] to throw an error`.

Po zmianie kontroli test na repo był czerwony z błędem „Wiersze Copy ekranu powtarzają tabelę „## Copy” komponentów…”: `SC-01 · components/AuthPage/authPageMessages.ts · „Regulamin i polityka prywatności”`, `SC-01 · components/PasswordField/passwordFieldMessages.ts · „Pokaż”`, `… · „Ukryj”`. Po usunięciu wierszy z SC-01: `pnpm vitest run --project web copyRegister` — 19 passed.

Mutacja (zmiana, test, przywrócenie): bez warunku „tekst nie pochodzi z własnego pliku ekranu” (`!ownTexts.has(text)`) — `Tests 2 failed | 17 passed (19)` (fixture T-106 `screenRowOnly` i fixture T-108 z SC-06 `dup.show`).

Pełne sprawdzenie: `pnpm check` exit 0 (`Test Files 155 passed`, `Tests 1261 passed`), `pnpm build` exit 0. Kod aplikacji bez zmian (tylko test i dokumenty).

## Regression

- T-100, T-106, T-107: wszystkie fixture `copyRegister` zielone; test na repo zielony.
- Ekrany SC-01–SC-09: kod bez zmian.

## Prevention

Rejestr Copy w obu kierunkach: tekst w kodzie ma wiersz (T-100), a wiersz ma tekst w kodzie albo jawne źródło spoza kodu web.

W tym tasku: reguła „ekran nie powtarza wierszy komponentów” jest teraz kontrolą testu, nie tylko prozą. Kierunek „wiersz bez kodu” pozostaje jako proponowany task (lista w „Other occurrences”).

<!-- QA rounds are appended below by /qa-task -->
