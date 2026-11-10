---
id: T-115
title: "Dopiski Copy „złożony z części” i „mail z API” sprawdzane; zgodny wiersz SC-06 delete.confirm"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
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

- [ ] AC1: Given wiersz Copy z dopiskiem `złożony z części`, którego ekran nie ma żadnego wiersza „(część `<klucz>`…)” pokazywanego przez kod ekranu, when uruchamia się test Copy, then test jest czerwony i wskazuje ekran i klucz. — verified by: fikstura w `apps/web/src/screens/copyRegister.test.ts`
- [ ] AC2: Given wiersz złożony z częściami, które kod pokazuje, then brak błędu. — verified by: fikstura
- [ ] AC3: Given SC-06, then `delete.confirm` i `delete.consequence` zapisują skutek tak samo (ten sam zapis odmiany `{uczestników}` albo jawny opis odmiany w Copy). — verified by: odczyt `SC-06-lista.md` i test Copy repo
- [ ] AC4: Given Copy SC-03 `mail.subject` i `mail.body`, when zmienia się tekst maila w `reset-mail.ts` albo w Copy, then test w `apps/api` jest czerwony. Jeśli test API okaże się nieproporcjonalny, właściciel decyduje o jawnym wyłączeniu, a opis trafia do `web.md:103` i nagłówka testu Copy. — verified by: test w `apps/api` (albo zapis decyzji)
- [ ] AC5: Given repo, then test Copy repo jest zielony. — verified by: `pnpm vitest run --project web copyRegister`
- [ ] AC7: Given `docs/architecture/layers/web.md` („Pułapki”, akapit testu Copy) i nagłówek `apps/web/src/screens/copyRegister.test.ts`, then opisują sprawdzanie dopisków `złożony z części` i `mail z API` tak, jak działa po tym zadaniu, a historia zmian `web.md` ma wiersz T-115 (T-114 opisał je jako niesprawdzane; decyzja właściciela 2026-11-10). — verified by: odczyt wobec `apps/web/test/copyRegister.ts`
- [ ] AC6: No regression in: T-100, T-108, T-109, T-111, T-113; mail resetu (T-053, T-055).

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

<Wypełnia /fix.>

## Evidence

<Wypełnia /fix.>

## Prevention

Propozycja z przeglądu 2026-11-10: każdy dopisek, który zwalnia wiersz Copy, ma własną kontrolę. Dopisek bez kontroli to błąd testu. Do decyzji właściciela.

<!-- QA rounds are appended below by /qa-task -->
