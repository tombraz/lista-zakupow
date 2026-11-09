---
id: T-111
title: "Wiersze Copy bez kodu web: rozstrzygnięcie dla każdego z 9 wierszy i kontrola w teście Copy"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa              # todo | in-progress | in-qa | done | blocked
depends_on: [T-109]
layers: [web]
requirements: []
threats: []
screens: [SC-02, SC-03, SC-06, SC-07, SC-08, SC-09]
related_tasks: [T-100, T-108]
---

# T-111 Wiersze Copy bez kodu web: rozstrzygnięcie dla każdego z 9 wierszy i kontrola w teście Copy

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-09-1.md`, P3 (minor). Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:** przy T-108 właściciel zdecydował 2026-11-09, że pełna kontrola odwrotna (wiersz Copy, którego tekstu nie pokazuje kod web) trafi do osobnego zadania. Pomiar dał 9 wierszy w SC-02, SC-03 i SC-06–SC-09 (lista w `docs/backlog/fixes/T-108-wiersz-legal-sc-01-po-copy-komponentow.md`, „Other occurrences”), ale zadania nie utworzono. Sprawdzono dwa wiersze:
  - SC-02 `consent.terms`: kod składa tekst z części (`SC-02-rejestracja/messages.ts:15`).
  - SC-08 `joined`: komunikat pokazuje SC-06 (`SC-06-lista/messages.ts:20`).

  Oba to tekst złożony albo pokazany na innym ekranie, a nie brak w kodzie. Pozostałe wymagają decyzji.
- **Expected:** każdy wiersz Copy ma swój tekst w kodzie albo opisany powód (mail, API, mobile, wiersz-źródło części, tekst pokazany na innym ekranie). Wiersz bez kodu i bez powodu jest błędem testu. Źródło: `web.md:103` (Copy jest pełnym rejestrem tekstów ekranu), decyzja właściciela przy T-108 AC2.
- **Steps to reproduce:** lista 9 wierszy w T-108, „Other occurrences”.
- **Environment:** lokalnie, commit `f0eb4d6`.
- **Evidence:** `docs/reviews/E-02-2026-11-09-1.md`, P3; T-108 AC2.

## Acceptance criteria

- [ ] AC1: Given 9 wierszy z T-108, then każdy ma zapisaną decyzję właściciela. Wiersz usunięty (martwy), dopisek w komórce wskazujący źródło (np. `(mail; T-055)`, `(część consent.terms)`, `(pokazuje SC-06)`) albo błąd kodu z osobnym zadaniem. — verified by: przegląd QA, tabela decyzji w „Root cause”
- [ ] AC2: Given wiersz Copy ekranu, którego tekstu nie ma w tekstach ekranu ani w tekstach z dopiskiem źródła, when uruchamia się test Copy, then test jest czerwony i wskazuje ekran i klucz. — verified by: fikstura w `apps/web/src/screens/copyRegister.test.ts`
- [ ] AC3: Given repo po zmianie, then test Copy repo jest zielony. — verified by: `pnpm vitest run --project web copyRegister`
- [ ] AC4: No regression in: T-100, T-108 (dublet Copy komponentów), T-109.

## TDD plan

**Seam:** `findCopyGaps` z fikstur.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | wiersz Copy bez kodu i bez dopisku → błąd | unit | Vitest | AC2 |
| 2 | wiersz z dopiskiem źródła → brak błędu | unit | Vitest | AC2 |

**Run:** `pnpm vitest run --project web copyRegister`

## QA plan

- **Regression:** Copy SC-01–SC-09, Copy komponentów w `design-system.md`.
- **Edge cases:** wiersz-źródło części (`leave.confirm` i `leave.confirm.question`), tekst z parametrem `{nazwa}`, tekst z maila (T-055), tekst pokazywany na innym ekranie (SC-08 `joined`).
- **Platforms:** web.

## Decisions

Właściciel 2026-11-09 (wszystkie trzy grupy: dopisek, żaden wiersz nie jest usuwany):
- wiersze-źródła części zostają jako czytelne pełne zdanie, dopisek „(złożony z części; T-111)”;
- mail SC-03 zostaje w Copy SC-03, dopisek „(mail z API; T-053)” (tekst w `apps/api/src/modules/konta/domain/reset-mail.ts` jest identyczny z Copy);
- tekst pokazany na innym ekranie zostaje w Copy ekranu, który go wywołuje, dopisek „(pokazuje SC-xx; T-111)”.

## Root cause

Test Copy (T-100) sprawdzał tylko kierunek kod → Copy; T-108 dodał tylko kontrolę dubla komponentu. Wiersz Copy bez tekstu w kodzie web przechodził po cichu, więc rejestr mógł mieć martwe wiersze albo teksty spoza web bez opisanego źródła. Dlaczego testy nie złapały: kontroli odwrotnej nie było z decyzji (T-108 AC2), a pomiar wymagał rozstrzygnięcia każdego wiersza.

Pomiar na repo dał 10 wierszy (T-108 liczył maila SC-03 jako jeden):

| Ekran | Klucz | Dlaczego bez kodu web | Decyzja |
| --- | --- | --- | --- |
| SC-02 | `consent.terms` | kod składa z `consent.terms.accept/termsLink/and/privacyLink` | dopisek „(złożony z części; T-111)” |
| SC-02 | `haveAccount` | kod składa z `haveAccount.text` + `haveAccount.link` | dopisek „(złożony z części; T-111)” |
| SC-02 | `error.emailTaken` | kod składa z `error.emailTaken.text/or/reset` + `haveAccount.link` | dopisek „(złożony z części; T-111)” |
| SC-03 | `mail.subject` | tekst maila tworzony przez API (T-053) | dopisek „(mail z API; T-053)” |
| SC-03 | `mail.body` | tekst maila tworzony przez API (T-053) | dopisek „(mail z API; T-053)” |
| SC-06 | `delete.confirm` | kod składa z `delete.question` + `delete.consequence` | dopisek „(złożony z części; T-111)” |
| SC-07 | `remove.confirm` | kod składa z `remove.confirm.question` + `.consequence` | dopisek „(złożony z części; T-111)” |
| SC-07 | `leave.confirm` | kod składa z `leave.confirm.question` + `.consequence` | dopisek „(złożony z części; T-111)” |
| SC-08 | `joined` | komunikat pokazuje SC-06 (`SC-06-lista/messages.ts`, `joined`) | dopisek „(pokazuje SC-06; T-111)” |
| SC-09 | `deleted` | komunikat pokazuje SC-01 (`info.accountDeleted`) | dopisek „(pokazuje SC-01; T-111)” |

Błędu kodu nie znaleziono; żaden wiersz nie wymaga osobnego zadania.

Zmiany:
- `apps/web/test/copyRegister.ts`: `findUnusedCopyRows` i `formatUnusedCopyRows` — wiersz Copy ekranu, którego tekstu nie ma w tekstach ekranu (z modułami wspólnymi i komponentami, które ekran importuje), i bez dopisku źródła (`COPY_SOURCE`: osobny segment dopisku `mail z API`, `mobile`, `złożony z części`, `pokazuje SC-xx`). `copyRows` czyta wiersze z kluczem i dopiskiem (bez nagłówka tabeli); `copyTexts` z niego korzysta. Osobna funkcja, nie błąd w `findCopyGaps`, bo fikstury kierunku kod → Copy celowo mają wiersze bez kodu.
- `apps/web/src/screens/copyRegister.test.ts`: test na repo i trzy fikstury; nagłówek.
- `docs/design/screens/SC-02, SC-03, SC-06–SC-09`: dopiski źródła w 10 wierszach.
- `docs/architecture/layers/web.md`: „Pułapki”, „Gdzie jest kod”, historia zmian.

## Other occurrences

Brak: kontrola obejmuje wszystkie ekrany SC-01–SC-09; na repo po dopiskach zgłasza 0 wierszy. Copy komponentów w `design-system.md` nie jest sprawdzane w tym kierunku (komponent bez ekranu, który go importuje, nie ma „kodu ekranu”); poza zakresem AC.

## Evidence

Red (zaślepka `findUnusedCopyRows` zwracająca `[]`): `findUnusedCopyRows (fixtures, T-111) > a Copy row whose text the screen code does not show and without a source note is reported with screen and key` i `> a note without a source marker does not excuse a row; `a / b` rows are checked per text` — `AssertionError: expected [] to deeply equal [ { screen: 'SC-07', …(2) }, …(1) ]`.

Po implementacji test na repo czerwony z 10 wierszami („Wiersze Copy ekranu bez tekstu w kodzie web ekranu i bez dopisku źródła…”, m.in. `SC-08 · joined · „Dołączyłeś(-aś) do listy „{…}”.”`). Po dopiskach: `pnpm vitest run --project web copyRegister` — 27 passed.

Mutacja (zmiana, test, przywrócenie): bez `!COPY_SOURCE.test(note)` — `Tests 2 failed | 25 passed (27)` (test na repo i fikstura z dopiskami źródła).

Pełne sprawdzenie: `pnpm check` exit 0 (`Test Files 155 passed`, `Tests 1269 passed`; format, lint, typecheck, quality, design-check, backlog-check, workflow-check, mobile), `pnpm build` exit 0. Kod aplikacji bez zmian.

## Regression

- T-100, T-106, T-107, T-108, T-109: wszystkie dotychczasowe fikstury `copyRegister` zielone; test na repo kierunku kod → Copy zielony (dopiski nie zmieniają tekstu komórki, bo `NOTE` je zdejmuje).
- Ekrany SC-01–SC-09: kod bez zmian.

## Prevention

Co zapobiegłoby: kontrola w obu kierunkach od T-100. Teraz jest (AC2): nowy wiersz Copy bez kodu albo dopisku źródła zatrzymuje `pnpm check`. Wpis w „Pułapkach” `web.md` opisuje słownik dopisków.

<!-- QA rounds are appended below by /qa-task -->
