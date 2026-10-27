---
id: T-003
title: Szkielet aplikacji mobilnej
epic: E-01
story: S-01-01
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-001, T-002]
size: M                # S | M (L must be split)
layers: [mobile, infra]
requirements: [N-01, N-04]
threats: [TH-16, TH-23]
screens: []
---

# T-003 Szkielet aplikacji mobilnej

## Goal

Aplikacja Expo (Android i iOS) uruchamia się, pokazuje stan API i bazy z lokalnego api i używa tokenów z `tokens.ts`. Działają testy ekranów (Jest + RNTL), lint z regułami dostępności RN, flow Maestro na emulatorze Androida w CI i build iOS na symulator. Przewodnik warstwy mobile ma prawdziwe ścieżki i komendy.

## Demo

1. Komenda z przewodnika mobile uruchamia Expo; na emulatorze Androida (i na telefonie w tej samej sieci) aplikacja pokazuje „Wspólna lista zakupów” i „API działa · baza działa”.
2. Po zatrzymaniu api: „Nie można połączyć się z serwerem”.
3. PR zmieniający `apps/mobile/**` uruchamia w CI job mobile: lint, typy, testy, design check, Maestro na emulatorze, build iOS symulatora — `ci-ok` zielony.

## Context

- `docs/architecture/layers/mobile.md` — technologia, testy, zasady bezpieczeństwa, pułapka `10.0.2.2`.
- `docs/architecture/pipeline.md` — job mobile (Maestro na emulatorze, lokalny build Gradle bez EAS, KVM), etap 7 (profile EAS w E-04).
- `docs/design/design-system.md`, „Uwagi platformowe”.
- Depends on: T-001 — `/health/ready`, `packages/tokens` (`tokens.ts`), `packages/shared`; T-002 — `ci.yml` z filtrem ścieżek i `ci-ok`, do którego dochodzi job mobile.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given ekran startowy z podstawionym API (MSW), when API zwraca „gotowe” / „baza niedostępna” / błąd sieci, then ekran pokazuje odpowiedni polski tekst z rolą i etykietą dostępną. — verified by: test ekranu (Jest + RNTL, `getByRole` / `getByText`)
- [ ] AC2: Given lokalne api, when uruchomię flow Maestro na emulatorze Androida, then aplikacja pokazuje „API działa · baza działa”. — verified by: Maestro flow `health.yaml`
- [ ] AC3: Given PR zmieniający `apps/mobile/**` lub `packages/shared/**`, when CI się zakończy, then job mobile (lint z `eslint-plugin-react-native-a11y`, typy, testy, design check, Maestro Android, build iOS symulatora) przeszedł i wchodzi do `ci-ok`; PR bez tych zmian go pomija. — verified by: rung 3, link do przebiegu
- [ ] AC4: Given aplikacja, when sprawdzę wygląd, then wartości kolorów, odstępów i typografii pochodzą wyłącznie z `tokens.ts`; `design-check --scan apps/mobile/src` przechodzi. — verified by: `design-check` w CI
- [ ] AC5: Given `docs/architecture/layers/mobile.md`, when nowa osoba wykona komendy z sekcji „Komendy” (install, start, testy, E2E, build lokalny), then działają; adres API pochodzi z konfiguracji środowiska Expo (emulator: `10.0.2.2`). — verified by: ręczne przejście przez QA
- [ ] SEC1 (TH-23): Given paczka aplikacji i `app.config`, when przeszukam je, then zawierają tylko publiczny adres API, bez kluczy i sekretów; build wydania nie ma menu deweloperskiego. — verified by: test konfiguracji (unit) sprawdzający dozwolone klucze `extra` + przegląd w QA
- [ ] SEC2 (TH-16): Given konfiguracja projektu, when ktoś doda zapis do AsyncStorage pod kluczem związanym z sesją, then lint zgłasza błąd (sesja tylko w `expo-secure-store`). — verified by: reguła `no-restricted-imports` / `no-restricted-syntax` + celowe naruszenie (Evidence)

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- ekran startowy z klientem API podstawionym przez MSW
- aplikacja na emulatorze (Maestro) z prawdziwym lokalnym api
- przebieg CI (job mobile)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | ekran startowy: trzy stany | component | Jest + RNTL + MSW | AC1 |
| 2 | konfiguracja `extra` zawiera tylko `apiUrl` | unit | Jest | SEC1 |
| 3 | flow Maestro: start → tekst stanu | E2E | Maestro | AC2 |
| 4 | job mobile w CI na PR | real run | GitHub Actions | AC3, AC4 |

**Run:** komendy „wszystkie testy warstwy” i „E2E (Maestro)” z przewodnika mobile (ustalane w tym tasku)

**Mocks:** API (MSW) w testach ekranów; moduły natywne bez implementacji w Jest (SecureStore, NetInfo).

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** api niedostępne przy starcie i pojawiające się później (ponowienie); brak sieci na telefonie.
- **Design states:** gotowe, baza niedostępna, brak połączenia z serwerem.
- **Platforms / devices:** emulator Androida, prawdziwy telefon z Androidem (development build lub Expo Go, jeśli zgodne), symulator iOS (build z CI lub lokalnie na Macu, jeśli dostępny).
- **Accessibility:** TalkBack czyta tytuł i stan; największy rozmiar tekstu systemowego nie ucina treści; bezpieczne obszary ekranu.
- **Security / privacy:** brak sekretów w `app.config` i paczce; logi aplikacji bez danych osobowych.
- **Regression:** web i api z T-001 działają bez zmian; `ci-ok` dla PR bez zmian mobile.

## Implementation notes

- Expo z expo-router; struktura z przewodnika: `apps/mobile/app/`, `apps/mobile/src/screens/`, `apps/mobile/src/components/`, `apps/mobile/src/api/`.
- Mobile używa Jest (preset Expo), nie Vitest (`testing-strategy.md`).
- W CI emulator Androida wymaga KVM na runnerze Linux; build Gradle lokalnie w jobie, nie przez EAS (limit 15 buildów). Profile EAS i dystrybucja APK — E-04.
- Better Auth Expo i SecureStore przychodzą z logowaniem w E-04; tu tylko reguła lint chroniąca przed sesją w AsyncStorage.

## Definition of done

- [ ] All tests in the TDD plan written test-first and passing
- [ ] Full test suite, type check and lint pass
- [ ] Every acceptance criterion checked, with evidence below
- [ ] Global definition of done from `docs/architecture/testing-strategy.md` met
- [ ] Architecture docs updated where the task changed what they describe (`pipeline.md`, `tech-stack.md`, layer guides in `docs/architecture/layers/`); deliberate deviations recorded there, not only in Evidence
- [ ] Handed to QA (`status: in-qa`)

Only a QA verdict "pass" from `/qa-task` sets `status: done`.

## Evidence

<Filled by /implement-task: test names, command output summary, screenshots for UI.>

<!-- QA rounds are appended below by /qa-task -->
