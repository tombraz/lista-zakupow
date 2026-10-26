---
id: S-01-01
epic: E-01
title: Szkielet techniczny i staging
status: todo           # todo | in-progress | done
requirements: [N-01, N-03, N-04]
screens: []
---

# S-01-01 Szkielet techniczny i staging

**As** właściciel projektu, **I want** działający od końca do końca szkielet (baza, API, web, mobile) za CI z bramkami jakości i bezpieczeństwa oraz automatyczne wdrożenie na staging, **so that** każda kolejna funkcja jest od pierwszego dnia testowana, sprawdzana i możliwa do pokazania domownikom.

## Acceptance criteria (business)

- [ ] Given świeży klon repozytorium, when właściciel uruchomi komendy z przewodników warstw, then web i aplikacja mobilna pokazują, że API i baza działają.
- [ ] Given PR z celowo zepsutym testem, when CI się zakończy, then merge jest zablokowany.
- [ ] Given merge do `main`, when pipeline się zakończy, then nowa wersja działa na `lista-staging.fly.dev`, a smoke test i skan ZAP przechodzą.

## Tasks

- T-001 Walking skeleton: API, baza i web lokalnie
- T-002 CI z bramkami jakości i bezpieczeństwa
- T-003 Szkielet aplikacji mobilnej
- T-010 Wdrożenie na staging

## Notes

- Kandydaci na taski infra 1, 2, 3 z `docs/architecture/pipeline.md`; produkcja, monitoring i mobile EAS w E-03 / E-04.
- Wszystkie workflow wg `.claude/skills/ci-cd/references/github-actions.md` (drabina weryfikacji).
- Ustawienia repozytorium (ochrona `main`, środowiska, sekrety) zmienia właściciel — task przygotowuje skrypt `gh`.
