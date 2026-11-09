---
id: T-113
title: "Dopisek Copy „pokazuje SC-xx” sprawdzany: tekst wiersza jest w tekstach ekranu SC-xx"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: small-change     # bug | small-change
severity: low          # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: [T-111]
layers: [web]
requirements: []
threats: []
screens: [SC-08, SC-09]
related_tasks: [T-100, T-111]
---

# T-113 Dopisek Copy „pokazuje SC-xx” sprawdzany: tekst wiersza jest w tekstach ekranu SC-xx

## Report

Źródło: QA T-111, runda 1, uwaga minor (follow-up); właściciel 2026-11-09: osobne zadanie, tylko dla dopisku „pokazuje SC-xx”. Gałąź: `epic/E-02-konto-i-uczestnicy` albo `fix/T-113-…` z `main` po scaleniu epiku (`git-workflow.md`, „Fixes”).

- **Actual:** `findUnusedCopyRows` (`apps/web/test/copyRegister.ts`, T-111) przepuszcza wiersz Copy z dopiskiem „(pokazuje SC-xx; …)” bez sprawdzenia, że kod ekranu SC-xx pokazuje ten tekst. Jeśli komunikat zniknie z SC-06, wiersz SC-08 `joined` zostanie martwy, a test będzie zielony.
- **Expected:** wiersz z dopiskiem „pokazuje SC-xx” przechodzi tylko wtedy, gdy jego tekst jest w tekstach ekranu SC-xx (te same teksty, które liczy test Copy dla SC-xx). Inaczej test jest czerwony i wskazuje ekran, klucz i SC-xx. Nieistniejący ekran SC-xx to też błąd. Źródło: decyzja właściciela 2026-11-09 przy QA T-111.
- **Steps to reproduce:** w `docs/design/screens/SC-08-zaproszenie.md` zmienić dopisek `joined` na „(pokazuje SC-05; T-111)” i uruchomić `pnpm vitest run --project web copyRegister`: test przechodzi, choć SC-05 nie pokazuje tego tekstu.
- **Environment:** lokalnie, gałąź `epic/E-02-konto-i-uczestnicy` po T-111 (`72be75c`).
- **Evidence:** QA T-111 runda 1 (tabela w `docs/backlog/fixes/T-111-wiersze-copy-bez-kodu-web.md`).

Poza zakresem (decyzja właściciela 2026-11-09): sprawdzanie dopisków „złożony z części” (wymaga znajomości składania tekstu) i „mail z API” (test web czytałby kod `apps/api`).

## Acceptance criteria

- [ ] AC1: Given wiersz Copy z dopiskiem „pokazuje SC-xx”, którego tekstu nie ma w tekstach ekranu SC-xx (albo SC-xx nie istnieje), when uruchamia się test Copy, then test jest czerwony i wskazuje ekran, klucz i SC-xx. — verified by: fikstura w `apps/web/src/screens/copyRegister.test.ts`
- [ ] AC2: Given wiersz z dopiskiem „pokazuje SC-xx”, którego tekst SC-xx pokazuje, then brak błędu. — verified by: fikstura
- [ ] AC3: Given repo, then test Copy repo jest zielony (SC-08 `joined` → SC-06, SC-09 `deleted` → SC-01). — verified by: `pnpm vitest run --project web copyRegister`
- [ ] AC4: No regression in: T-100, T-108, T-109, T-111.

## TDD plan

**Seam:** `findUnusedCopyRows` z fikstur.

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | „pokazuje SC-xx”, tekstu nie ma w SC-xx → wiersz zgłoszony | unit | Vitest | AC1 |
| 2 | „pokazuje SC-xx” z nieistniejącym ekranem → wiersz zgłoszony | unit | Vitest | AC1 |
| 3 | „pokazuje SC-xx”, SC-xx pokazuje tekst → brak błędu | unit | Vitest | AC2 |

**Run:** `pnpm vitest run --project web copyRegister`

## QA plan

- **Regression:** Copy SC-01–SC-09; fikstury T-111 (dopiski `mail z API`, `mobile`, `złożony z części` bez zmian).
- **Edge cases:** tekst z parametrem `{nazwa}` (SC-08 `joined` ↔ SC-06 `joined`), dopisek z kilkoma segmentami („(pokazuje SC-06; T-111)”), dopisek wskazujący własny ekran.
- **Platforms:** web.

## Root cause

<Do uzupełnienia przy realizacji.>

## Evidence

<Reproducing test: red failure message, then passing. Full suite and static checks result.>

## Prevention

Dopisek „pokazuje SC-xx” przestaje być deklaracją: test sprawdza go z kodem ekranu SC-xx.

<!-- QA rounds are appended below by /qa-task -->
