---
id: S-01-01
epic: E-01
title: Szkielet techniczny i staging
status: done                  # todo | in-progress | done
requirements: [N-01, N-03, N-04]
screens: []
---

# S-01-01 Szkielet techniczny i staging

**As** właściciel projektu, **I want** działający od końca do końca szkielet (baza, API, web, mobile) za CI z bramkami jakości i bezpieczeństwa oraz automatyczne wdrożenie na staging, **so that** każda kolejna funkcja jest od pierwszego dnia testowana, sprawdzana i możliwa do pokazania domownikom.

## Acceptance criteria (business)

- [x] Given świeży klon repozytorium, when właściciel uruchomi komendy z przewodników warstw, then web i aplikacja mobilna pokazują, że API i baza działają.
- [x] Given PR z celowo zepsutym testem, when CI się zakończy, then merge jest zablokowany.
- [x] Given merge do `main`, when pipeline się zakończy, then nowa wersja działa na `lista-staging.fly.dev`, a smoke test i skan ZAP przechodzą.

## Tasks

- T-001 Walking skeleton: API, baza i web lokalnie
- T-002 CI z bramkami jakości i bezpieczeństwa
- T-003 Szkielet aplikacji mobilnej
- T-010 Wdrożenie na staging

## Notes

- Kandydaci na taski infra 1, 2, 3 z `docs/architecture/pipeline.md`; produkcja, monitoring i mobile EAS w E-03 / E-04.
- Wszystkie workflow wg `.claude/skills/ci-cd/references/github-actions.md` (drabina weryfikacji).
- Ustawienia repozytorium (ochrona `main`, środowiska, sekrety) zmienia właściciel — task przygotowuje skrypt `gh`.

## Story acceptance (QA, 2026-10-29)

Wszystkie taski (T-001, T-002, T-003, T-010) `done`. Sprawdzone end to end:

- Szkielet: obraz zbudowany z bieżącego drzewa uruchamia migracje, API i web pod jednym portem (`image-run.test.sh`, smoke OK); lokalnie `pnpm check` (poza znanym niestabilnym testem SC-08 z T-008); mobile: job `mobile-android` / `mobile-ios` zielony w CI epiku (`cccee82`). Świeżego klonu QA nie robił — instalacja `--frozen-lockfile` na czystym drzewie.
- Blokada merge: ochrona `main` wymaga `ci-ok` i `codeql`; PR #1 z czerwonym `ci-ok` ma `mergeStateStatus: BLOCKED`.
- Staging: przebieg 40882296349 — wdrożenie z migracjami, smoke i ZAP zielone; `lista-staging.fly.dev` działa (smoke QA OK). Wdrożenie z gałęzi `deploy-test/T-010` zamiast merge do `main` (decyzja właściciela); wyzwalacz `main` jest w `deploy.yml`, ale nie był jeszcze uruchomiony.
