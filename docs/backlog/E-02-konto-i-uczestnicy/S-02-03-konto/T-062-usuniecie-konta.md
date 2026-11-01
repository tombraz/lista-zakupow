---
id: T-062
title: Usunięcie konta (SC-09)
epic: E-02
story: S-02-03
status: todo           # todo | in-progress | in-qa | done | blocked
blocked_reason:        # filled only when status is blocked
depends_on: [T-056, T-063]
size: M                # S | M (L must be split)
layers: [backend, web]
requirements: [F-04, N-02, N-04]
threats: [TH-17, TH-18, TH-21, TH-28]
screens: [SC-09, SC-01, SC-06, SC-05]
---

# T-062 Usunięcie konta (SC-09)

## Goal

Domownik trwale usuwa konto z SC-09 po potwierdzeniu. Jego listy znikają także u uczestników, z cudzych list zostaje wypisany (pozycje zostają z podpisem „usunięty użytkownik”), wszystkie jego sesje i połączenia na żywo kończą się, a logowanie na to konto się nie udaje.

## Demo

1. Ania (właściciel „Dom” z uczestnikiem Tomkiem; uczestniczka „Działka” Oli, gdzie dodała „Węgiel”): SC-09 → „Usuń konto” → „Usunąć konto na zawsze? 1 Twoich list zniknie, także u ich uczestników. Tego nie da się cofnąć.” → „Usuń konto”.
2. Ania na SC-01 z „Konto zostało usunięte.”. Logowanie jej danymi → „Nieprawidłowy e-mail lub hasło.”.
3. Tomek z otwartą „Dom” → SC-05 z komunikatem o usunięciu listy. Ola na „Działka”: „Węgiel — dodał(a) usunięty użytkownik”; Ani nie ma na SC-07.
4. Druga przeglądarka Ani (inna sesja) przy następnej akcji trafia na SC-01.

## Context

- BRD: F-04 — „listy właściciela usuwane, uczestnicy tracą dostęp; z cudzych list wypisany, pozycje zostają z podpisem „usunięty użytkownik”; logowanie na usunięte konto się nie udaje; wymaga wyraźnego potwierdzenia”; N-02.
- Architektura: `api.md` „Konto” (`DELETE /api/v1/me { confirm: true }` → 204; `list.deleted` / `access.revoked` / `lists.changed` do dotkniętych osób; sesje zamknięte; 400 bez `confirm`), `data-model.md` (kaskady i `SET NULL`, inwentarz danych osobowych), TH-17, TH-18, TH-28, log `security` („usunięcie konta”).
- Design: SC-09 — sekcja „Usuń konto” (`h2`, opis skutków, przycisk niebezpieczny), ConfirmDialog z liczbą list `{n}` (fokus startowy na „Anuluj”), stany Loading (w oknie), Error — zapis, Offline („Usuń konto” nieaktywny), Success — usunięcie (SC-01 z „Konto zostało usunięte.”).
- Depends on: T-056 — `revoke` bez wyścigu z `subscribe`; T-063 — stan offline. Z T-054 może już istnieć zamykanie wszystkich połączeń użytkownika — użyj go, jeśli jest.

## Acceptance criteria

Each criterion must fail before the work and pass after it.

- [ ] AC1: Given domownik D: właściciel list L1, L2 (z uczestnikami), uczestnik listy M (dodał i odhaczył tam pozycje), when `DELETE /api/v1/me { confirm: true }`, then 204 i w jednej transakcji: L1, L2 z pozycjami, członkostwami i zaproszeniami usunięte; członkostwo w M usunięte; pozycje D w M mają `addedBy: null` / `checkedBy: null`; `user`, `session`, `account`, aktywność dzienna D usunięte. — verified by: test integracyjny (stan bazy przed i po)
- [ ] AC2: Given brak `confirm: true`, then 400 i nic się nie zmienia. — verified by: test integracyjny
- [ ] AC3: Given uczestnicy L1 z otwartą listą i uczestnicy M, when D usuwa konto, then uczestnicy L1 dostają `list.deleted` i `lists.changed` (SC-06 → SC-05 z komunikatem o usunięciu), uczestnicy M — `members.changed` i odświeżone pozycje z „usunięty użytkownik”. — verified by: test integracyjny WS + E2E dwa konteksty
- [ ] AC4: Given SC-09, when „Usuń konto”, then ConfirmDialog z liczbą własnych list i fokusem na „Anuluj”; „Usuń konto” w oknie → Loading → SC-01 (`replace`) z „Konto zostało usunięte.” (`role="status"`), sesja klienta wyczyszczona; błąd serwera — „Nie udało się zapisać. Spróbuj ponownie.” w oknie; offline — „Usuń konto” nieaktywny. — verified by: test komponentu (MSW)
- [ ] AC5: Given SC-09 z otwartym ConfirmDialog i SC-01 po usunięciu, when E2E je odwiedza, then axe bez naruszeń. — verified by: E2E + axe
- [ ] SEC1 (TH-17): Given D z dwiema sesjami, when usuwa konto, then żądanie z każdą z nich daje 401, a logowanie e-mailem i hasłem D — 401 `invalid_credentials` (ten sam co dla nieistniejącego konta). — verified by: test integracyjny
- [ ] SEC2 (TH-28): Given otwarte połączenia WS obu sesji D, when usuwa konto, then wszystkie gniazda D są zamknięte (1008), a nowe połączenie z jego ciasteczkiem odrzucone. — verified by: test integracyjny WS
- [ ] SEC3 (TH-18): Given inni domownicy z własnymi listami i pozycjami, when D usuwa konto, then ich listy, pozycje (także te odhaczone przez D) i członkostwa poza listami D są nienaruszone. — verified by: test integracyjny F-04
- [ ] SEC4 (TH-21): Given usunięcie konta, then log `security` ma zdarzenie `account_deleted` z `userId`, bez e-maila i imienia; anonim `DELETE /api/v1/me` → 401, obcy `Origin` → 403. — verified by: test logów + test integracyjny

## TDD plan

**Test seams** (public boundaries tested from outside; agreed during planning):

- HTTP API `DELETE /api/v1/me`, logowanie, WebSocket `/api/v1/live`
- ekran SC-09 z MSW
- przeglądarka (Playwright, dwa konteksty)

**Tests in order** (write one, see it fail, make it pass, then the next):

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | usunięcie konta wg F-04: listy, członkostwa, `SET NULL`, sesje, aktywność | integration | Vitest + Testcontainers | AC1 |
| 2 | dane innych nienaruszone | integration | Vitest + Testcontainers | SEC3 |
| 3 | bez `confirm` 400; anonim 401; obcy `Origin` 403 | integration | Vitest + Testcontainers | AC2, SEC4 |
| 4 | sesje 401, logowanie 401 `invalid_credentials` | integration | Vitest + Testcontainers | SEC1 |
| 5 | gniazda D zamknięte; zdarzenia do uczestników L1 i M | integration | Vitest + Testcontainers + `ws` | SEC2, AC3 |
| 6 | log `security` `account_deleted` | integration | Vitest | SEC4 |
| 7 | SC-09: dialog z liczbą list, fokus, Loading, błąd, offline, przejście na SC-01 | component | Vitest + RTL + MSW | AC4 |
| 8 | E2E: usunięcie konta właściciela przy otwartej liście uczestnika; axe | E2E | Playwright + axe | AC3, AC5 |

**Run:** komendy „wszystkie testy warstwy” z przewodników backend i web oraz E2E web

**Mocks:** API tylko w testach komponentów; baza prawdziwa.

**Client state during writes:** usunięcie — odpowiedź opóźniona (podwójne potwierdzenie = jedno żądanie; okna nie da się zamknąć w trakcie), utracona po zapisie (ponowienie dostaje 401 → klient i tak przechodzi na SC-01, bez fałszywego „Nie udało się”), liczba list zmienia się w trakcie otwartego okna (liczba z chwili otwarcia; po `lists.changed` aktualizowana).

## QA plan

What an independent tester checks beyond the automated tests:

- **Edge cases:** konto bez list; konto z 50 listami po 500 pozycji (czas usunięcia, brak timeoutu); usunięcie w trakcie, gdy uczestnik dodaje pozycję na liście D; ponowna rejestracja tym samym e-mailem po usunięciu (powinna działać); aktywne linki zaproszeń D przestają działać.
- **Design states:** SC-09: dialog, Loading, błąd, offline; SC-01 z komunikatem; SC-05 / SC-06 uczestników.
- **Platforms / devices:** telefon (Safari, Chrome), komputer.
- **Accessibility:** dialog (fokus na „Anuluj”, Escape), komunikat po usunięciu ogłaszany na SC-01.
- **Security / privacy:** po usunięciu w bazie nie ma e-maila ani imienia D (sprawdzić inwentarz z `data-model.md`, także `sign_in_failure` i `verification`); stara sesja D na drugim urządzeniu; logi bez danych osobowych.
- **Regression:** J-01 (rejestracja tym samym e-mailem), F-10 „usunięty użytkownik” (T-007), J-05.

## Implementation notes

- Better Auth ma własną ścieżkę usuwania użytkownika; tu własna trasa `DELETE /api/v1/me` z transakcją wg `data-model.md` (kaskady w schemacie), a potem zdarzenia i zamknięcie połączeń po commit. Identyfikatory list i uczestników do powiadomienia zebrać przed usunięciem.
- Liczba list do okna: z `GET /api/v1/lists` (`role: "owner"`).
- `verification` (tokeny resetu) i `sign_in_failure` kluczowane e-mailem / pseudonimem — usunąć wiersze D w tej samej transakcji albo opisać, czemu zostają do wygaśnięcia (sprzątanie T-064).

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
