---
id: T-115
title: "Dopiski Copy „złożony z części” i „mail z API” sprawdzane; zgodny wiersz SC-06 delete.confirm"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: in-qa          # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [web, backend]
requirements: []
threats: []
screens: [SC-02, SC-03, SC-06, SC-07]
related_tasks: [T-053, T-100, T-111, T-113]
---

# T-115 Dopiski Copy „złożony z części” i „mail z API” sprawdzane; zgodny wiersz SC-06 delete.confirm

## Report

Źródło: przegląd `docs/reviews/E-02-2026-11-10-1.md`, ustalenia K1 i S4. Właściciel zatwierdził zadanie 2026-11-10, zmieniając decyzję z 2026-11-09, która wyłączyła te dwa dopiski z zakresu T-113. Gałąź: `epic/E-02-konto-i-uczestnicy`.

- **Actual:**
  - `findUnusedCopyRows` (`apps/web/test/copyRegister.ts:52`, `:144`) przepuszcza wiersz Copy z dopiskiem `złożony z części` albo `mail z API` bez żadnej kontroli. Martwy wiersz przejdzie test po dopisaniu „(złożony z części; T-…)”.
  - Wiersz złożony i jego części to dwa zapisy tej samej treści i już się rozjechały. SC-06 `delete.confirm` ma „Usunąć listę „{nazwa}”? Zniknie też u {n} uczestników.” (`docs/design/screens/SC-06-lista.md:107`), a część `delete.consequence` ma „Zniknie też u {n} {uczestników}.” (`:133`), z odmianą (`apps/web/src/screens/SC-06-lista/messages.ts:96-100`).
  - Tekstu maila resetu (`apps/api/src/modules/konta/domain/reset-mail.ts:15-18`) nic nie porównuje z Copy SC-03 `mail.subject` i `mail.body` (`docs/design/screens/SC-03-reset-hasla.md:84-85`).
  - Wiersze `złożony z części`: `SC-02-rejestracja.md:69`, `:72`, `:74`; `SC-06-lista.md:107`; `SC-07-uczestnicy.md:70`, `:81`.
- **Expected:** każdy dopisek, który zwalnia wiersz Copy, jest sprawdzany tak jak `pokazuje SC-xx` po T-113. Źródło: T-111 „Expected” („każdy wiersz Copy ma swój tekst w kodzie albo opisany powód”), T-113 „Prevention”, decyzja właściciela 2026-11-10.
- **Steps to reproduce:** w `SC-06-lista.md` zmienić tekst `delete.confirm` na dowolny inny, zostawiając dopisek „(złożony z części; T-111)”, i uruchomić `pnpm vitest run --project web copyRegister`. Test przechodzi.
- **Environment:** gałąź `epic/E-02-konto-i-uczestnicy`, HEAD `3de5af5`.
- **Evidence:** przegląd E-02 2026-11-10, K1.

## Acceptance criteria

- [x] AC1: Given wiersz Copy z dopiskiem `złożony z części`, którego ekran nie ma żadnego wiersza „(część `<klucz>`…)” pokazywanego przez kod ekranu, when uruchamia się test Copy, then test jest czerwony i wskazuje ekran i klucz. — verified by: fikstura w `apps/web/src/screens/copyRegister.test.ts`
- [x] AC2: Given wiersz złożony z częściami, które kod pokazuje, then brak błędu. — verified by: fikstura
- [x] AC3: Given SC-06, then `delete.confirm` i `delete.consequence` zapisują skutek tak samo (ten sam zapis odmiany `{uczestników}` albo jawny opis odmiany w Copy). — verified by: odczyt `SC-06-lista.md` i test Copy repo
- [x] AC4: Given Copy SC-03 `mail.subject` i `mail.body`, when zmienia się tekst maila w `reset-mail.ts` albo w Copy, then test w `apps/api` jest czerwony. Jeśli test API okaże się nieproporcjonalny, właściciel decyduje o jawnym wyłączeniu, a opis trafia do `web.md:103` i nagłówka testu Copy. — verified by: test w `apps/api` (albo zapis decyzji)
- [x] AC5: Given repo, then test Copy repo jest zielony. — verified by: `pnpm vitest run --project web copyRegister`
- [x] AC7: Given `docs/architecture/layers/web.md` („Pułapki”, akapit testu Copy) i nagłówek `apps/web/src/screens/copyRegister.test.ts`, then opisują sprawdzanie dopisków `złożony z części` i `mail z API` tak, jak działa po tym zadaniu, a historia zmian `web.md` ma wiersz T-115 (T-114 opisał je jako niesprawdzane; decyzja właściciela 2026-11-10). — verified by: odczyt wobec `apps/web/test/copyRegister.ts`
- [x] AC6: No regression in: T-100, T-108, T-109, T-111, T-113; mail resetu (T-053, T-055).

## TDD plan

**Seam:** `findUnusedCopyRows` z fikstur; funkcja tekstu maila w `apps/api/src/modules/konta/domain/reset-mail.ts`.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `złożony z części` bez wiersza-części w kodzie → wiersz zgłoszony | unit | Vitest | AC1 |
| 2 | `złożony z części` z częścią, którą kod pokazuje → brak błędu | unit | Vitest | AC2 |
| 3 | temat i treść maila resetu równe Copy SC-03 (z `{link}`) | unit | Vitest | AC4 |

**Run:** `pnpm vitest run --project web copyRegister` oraz `pnpm vitest run --project api reset-mail`

## QA plan

- **Regression:** Copy SC-01–SC-09, fikstury T-111 i T-113, mail resetu na Mailpit.
- **Edge cases:** wiersz z kilkoma częściami (SC-02 `emailTaken`), część z parametrem, część używana przez dwa wiersze złożone, dopisek z kilkoma segmentami.
- **Platforms:** web, API.

## Root cause

`COPY_SOURCE` (`apps/web/test/copyRegister.ts`, T-111) traktował `złożony z części` i `mail z API` jak deklaracje: sama obecność dopisku zwalniała wiersz. Przy `złożony z części` nic nie wiązało wiersza z jego wierszami-częściami, więc martwy wiersz i rozjazd treści (SC-06 `delete.confirm` „{n} uczestników” wobec części `delete.consequence` „{n} {uczestników}”) przechodziły. Tekstu maila z `apps/api` nie porównywał żaden test, bo test web świadomie nie czyta kodu API (decyzja 2026-11-09, T-113). Testy tego nie wyłapały, bo fikstura T-111 sprawdzała tylko, że dopisek wiersz _zwalnia_, a nie że _nie zwalnia_ wiersza bez części.

Poprawka: `złożony z części` wyjęte z `COPY_SOURCE` do `COMPOSED`; wiersz przechodzi tylko, gdy Copy ekranu ma wiersze „(część `<klucz>`…)” (`PART_OF`, także „część `a`, `b`”), jego tekst zawiera tekst każdej części i kod ekranu pokazuje co najmniej jedną część (`composedProblem`, pole `composed` w zgłoszeniu). `mail z API` sprawdza nowy test `apps/api/test/reset-mail.copy.test.ts`: wiersze `mail z API` ze wszystkich specyfikacji są równe tematowi i treści z `passwordResetMail` (link jako `{link}`). SC-06 `delete.confirm` (i opis w „Interactions”) zapisuje odmianę jak część: „{n} {uczestników}”. Ten sam wzorzec gdzie indziej: `mobile` nadal zwalnia bez sprawdzenia (kodu mobile nie ma do E-04).

## Evidence

- Red (przed poprawką), `pnpm vitest run --project web copyRegister`: 3 failed | 32 passed — `findUnusedCopyRows (fixtures, T-111) > note „złożony z części” is checked against its part rows (T-115) >` „a composed row without any part row is reported with screen and key”, „a composed row whose part rows the screen code does not show is reported, and so is each part”, „a composed row that does not contain the text of its part is reported with the part”: `AssertionError: expected [] to deeply equal [ { screen: 'SC-07', …(4) } ]` (i analogiczne). „a composed row whose parts the screen code shows is not reported…” był zielony już przed poprawką (AC2).
- Po poprawce testu, przed zmianą SC-06: test repo czerwony — `SC-06 · delete.confirm · „Usunąć listę „{…}”? Zniknie też u {…} uczestników.” (złożony z części: tekst nie zawiera części delete.consequence)` (rozjazd K1, AC3). Po ujednoliceniu SC-06: 35 passed.
- Krok z raportu po poprawce: `delete.confirm` „Skasować listę…” → czerwony („tekst nie zawiera części `delete.question`”); zmiana cofnięta.
- `pnpm vitest run --project api reset-mail.copy`: zielony na repo; czerwony po zmianie „żeby” → „aby” w `reset-mail.ts` i po zmianie „—” → „-” w Copy SC-03 `mail.subject` (obie cofnięte). Na repo test nie miał fazy red, bo mail i Copy były zgodne; dowodem działania są te dwie mutacje.
- `pnpm check` (format, lint, typecheck, quality, design-check, backlog-check, workflow-check, test 156 plików / 1278 testów, test:mobile 10): exit 0; `pnpm build`: OK.

## Prevention

Propozycja z przeglądu 2026-11-10: każdy dopisek, który zwalnia wiersz Copy, ma własną kontrolę. Dopisek bez kontroli to błąd testu. Do decyzji właściciela.

Stan po T-115: `pokazuje SC-xx`, `złożony z części` i `mail z API` mają kontrolę; bez kontroli zostaje tylko `mobile` (opis w `web.md` „Pułapki” i w nagłówku testu Copy).

<!-- QA rounds are appended below by /qa-task -->
