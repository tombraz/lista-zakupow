---
id: T-051
title: "Redakcja tokenu zaproszenia w logu obejmuje każdy zapis ścieżki"
kind: fix              # fix tasks live in docs/backlog/fixes/ and have no epic or story
type: bug              # bug | small-change
severity: normal       # incident | high | normal | low
status: todo           # todo | in-progress | in-qa | done | blocked
depends_on: []
layers: [backend]
requirements: [F-12]
threats: [TH-08, TH-21, TH-26]
screens: []
related_tasks: [T-008, T-049]
---

# T-051 Redakcja tokenu zaproszenia w logu obejmuje każdy zapis ścieżki

## Report

Źródło: T-049 (inne wystąpienie wzorca TH-26, sekcja „Root cause”).

- **Actual:** `redactedUrl` (`apps/api/src/logging.ts`) redaguje token zaproszenia wyrażeniem `INVITATION_TOKEN_PATH`, czyli po prefiksie surowej ścieżki (`/api/v1/invitations/`, `/zaproszenie/`). Router dopasowuje trasę po zdekodowanej ścieżce, więc ścieżka z zakodowaną literą trafia do tras zaproszeń (podgląd, przyjęcie), a token zostaje w logu jawnym tekstem.
- **Expected:** token zaproszenia nie trafia do logu, niezależnie od zapisu ścieżki. Źródło: TH-08 („logi API redagują ścieżkę `/invitations/:token`”), TH-21, TH-26.
- **Steps to reproduce:** zapisy ścieżki jak w `spellings()` w `apps/api/test/origin.test.ts` (T-049), zastosowane do `/api/v1/invitations/:token` i `/api/v1/invitations/:token/accept`; w logu (`captureLogs()`) pole `req.url` zawiera token.
- **Environment:** lokalnie, po T-049.
- **Evidence:** analiza kodu w T-049; ryzyko niskie: token pochodzi od samego żądającego, a klient web używa kanonicznej ścieżki. Ślad tokenu w logach to jednak dokładnie to, przed czym chroni TH-08.

## Acceptance criteria

- [ ] AC1: Given żądanie do trasy zaproszenia (podgląd, przyjęcie) w wariancie zapisu ścieżki, when API je loguje, then w logu (także w kanale `security`) nie ma tokenu, a ścieżka ma `[redacted]` w miejscu tokenu. — verified by: test integracyjny w `invitations.logs.test.ts`
- [ ] AC2: Given strona SC-08 `/zaproszenie/:token` w wariancie zapisu, when API ją loguje, then token jest zredagowany. — verified by: test integracyjny
- [ ] AC3: Redakcja opiera się na dopasowanej trasie (`request.routeOptions.url` z parametrem `:token`) albo na zdekodowanej ścieżce, nie na prefiksie surowego adresu (TH-26, `backend.md` „Zasady bezpieczeństwa”). — verified by: przegląd kodu w QA
- [ ] AC4: No regression in: `invitations.logs.test.ts`, `logging.test.ts`, J-04, redakcja `?token=` w query.

## TDD plan

**Seam:** HTTP API (`fastify.inject`) z przechwyconym logiem (`captureLogs()`)

| # | Test | Level | Framework | Proves |
| --- | --- | --- | --- | --- |
| 1 | `redacts the invitation token whatever the path spelling` | integracja | Vitest + Testcontainers | AC1 |
| 2 | `redacts the token of the SC-08 page whatever the path spelling` | integracja | Vitest + Testcontainers | AC2 |

**Run:** `pnpm vitest run --project api logs`

## QA plan

- **Regression:** podgląd i przyjęcie zaproszenia (J-04), log `security`, redakcja query (`?token=`).
- **Edge cases:**
  - zakodowane znaki w tokenie i w prefiksie;
  - nieprawidłowe sekwencje `%` (dekodowanie nie może rzucić wyjątku w serializerze logu);
  - nieznana trasa pod prefiksem zaproszeń;
  - wylogowane żądanie (log przed `requireSession`).
- **Platforms:** API.

## Root cause

<Uzupełnia /fix.>

## Evidence

<Uzupełnia /fix.>

## Prevention

Reguła lintu TH-26 z T-049 (`API_RAW_URL_SYNTAX`) nie obejmuje serializera logu (`raw.url` w `logging.ts`). Po poprawce rozważyć jej rozszerzenie na serializer albo test wariantów zapisu dla każdej ścieżki z tokenem.

<!-- QA rounds are appended below by /qa-task -->
